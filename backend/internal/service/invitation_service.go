package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"backend/internal/domain"

	"gorm.io/gorm"
)

// CreateInvitationRequest defines the API payload for inviting a new member
type CreateInvitationRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin member"`
}

// InvitationService outlines the required business logic for workspace invitations
type InvitationService interface {
	CreateInvitation(ctx context.Context, senderID string, workspaceID string, req CreateInvitationRequest) (*domain.Invitation, error)
	GetInvitation(ctx context.Context, token string) (*domain.Invitation, error)
	AcceptInvitation(ctx context.Context, token string, userID string, userEmail string) error
}

type invitationService struct {
	db             *gorm.DB // injected to perform transaction queries and quick joins
	invitationRepo domain.InvitationRepository
	emailService   EmailService
}

// NewInvitationService creates a new InvitationService instance
func NewInvitationService(db *gorm.DB, invitationRepo domain.InvitationRepository, emailService EmailService) InvitationService {
	return &invitationService{
		db:             db,
		invitationRepo: invitationRepo,
		emailService:   emailService,
	}
}

func (s *invitationService) CreateInvitation(ctx context.Context, senderID string, workspaceID string, req CreateInvitationRequest) (*domain.Invitation, error) {
	// 1. Verify workspace exists
	var ws domain.Workspace
	if err := s.db.WithContext(ctx).First(&ws, "id = ?", workspaceID).Error; err != nil {
		return nil, errors.New("workspace not found")
	}

	// 2. Authorization check: only workspace owners and admins can invite members
	if ws.OwnerID != senderID {
		var member domain.WorkspaceMember
		// Look up sender role in workspace_members table
		err := s.db.WithContext(ctx).Table("workspace_members").
			First(&member, "workspace_id = ? AND user_id = ? AND (role = 'owner' OR role = 'admin')", workspaceID, senderID).Error
		if err != nil {
			return nil, errors.New("permission denied: only workspace owners and admins can invite members")
		}
	}

	// 3. Generate secure 32-byte hex token
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("failed to generate secure token: %w", err)
	}
	token := hex.EncodeToString(b)

	// 4. Save invitation record in database
	invitation := &domain.Invitation{
		Email:       req.Email,
		WorkspaceID: workspaceID,
		Role:        req.Role,
		Token:       token,
		ExpiresAt:   time.Now().Add(7 * 24 * time.Hour), // Expire after 7 days
		CreatedBy:   senderID,
	}

	if err := s.invitationRepo.Create(ctx, invitation); err != nil {
		return nil, fmt.Errorf("failed to store invitation in database: %w", err)
	}

	// 5. Trigger email dispatch via Resend
	// Invite URL format: http://localhost:3000/invite/accept?token=...
	inviteURL := fmt.Sprintf("http://localhost:3000/invite/accept?token=%s", token)
	if err := s.emailService.SendInvitationEmail(ctx, req.Email, ws.Name, inviteURL); err != nil {
		// Log error but do not fail the request, because the invitation record is saved.
		// The mock email logger has also printed the link to stdout so it can be verified.
		slog.Error("failed to dispatch invitation email", "error", err, "to", req.Email)
	}

	return invitation, nil
}

func (s *invitationService) GetInvitation(ctx context.Context, token string) (*domain.Invitation, error) {
	invitation, err := s.invitationRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, errors.New("invitation not found or invalid token")
	}

	if invitation.AcceptedAt != nil {
		return nil, errors.New("invitation has already been accepted")
	}

	if time.Now().After(invitation.ExpiresAt) {
		return nil, errors.New("invitation token has expired")
	}

	return invitation, nil
}

func (s *invitationService) AcceptInvitation(ctx context.Context, token string, userID string, userEmail string) error {
	// 1. Fetch and validate the invitation token (ensures existence, unaccepted, and not expired)
	inv, err := s.GetInvitation(ctx, token)
	if err != nil {
		return err
	}

	// 2. Validate email match (user accepting must have the same email as the recipient)
	if inv.Email != userEmail {
		return errors.New("permission denied: your email does not match this invitation")
	}

	// 3. Execute joining and token invalidation in a PostgreSQL transaction
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to begin database transaction: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Check if already a member to prevent constraint violation
	var count int64
	tx.Table("workspace_members").
		Where("workspace_id = ? AND user_id = ?", inv.WorkspaceID, userID).
		Count(&count)
	if count > 0 {
		tx.Rollback()
		return errors.New("user is already a member of this workspace")
	}

	// Create workspace member record
	member := &domain.WorkspaceMember{
		WorkspaceID: inv.WorkspaceID,
		UserID:      userID,
		Role:        inv.Role,
		JoinedAt:    time.Now(),
	}
	if err := tx.Table("workspace_members").Create(member).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to register workspace member: %w", err)
	}

	// Update invitation status to accepted
	now := time.Now()
	if err := tx.Model(&domain.Invitation{}).Where("id = ?", inv.ID).Update("accepted_at", &now).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to mark invitation as accepted: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	slog.Info("user successfully accepted workspace invitation", "user_id", userID, "workspace_id", inv.WorkspaceID)
	return nil
}
