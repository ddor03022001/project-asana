package postgres

import (
	"context"
	"time"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type invitationRepo struct {
	db *gorm.DB
}

// NewInvitationRepository creates a GORM-based InvitationRepository instance
func NewInvitationRepository(db *gorm.DB) domain.InvitationRepository {
	return &invitationRepo{db: db}
}

func (r *invitationRepo) Create(ctx context.Context, invitation *domain.Invitation) error {
	return r.db.WithContext(ctx).Create(invitation).Error
}

func (r *invitationRepo) GetByToken(ctx context.Context, token string) (*domain.Invitation, error) {
	var invitation domain.Invitation
	// Preload the referenced Workspace so the client knows which team they are joining
	if err := r.db.WithContext(ctx).Preload("Workspace").First(&invitation, "token = ?", token).Error; err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (r *invitationRepo) Accept(ctx context.Context, token string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&domain.Invitation{}).
		Where("token = ? AND accepted_at IS NULL", token).
		Update("accepted_at", &now).Error
}

func (r *invitationRepo) GetByEmailAndWorkspace(ctx context.Context, email string, workspaceID string) (*domain.Invitation, error) {
	var invitation domain.Invitation
	if err := r.db.WithContext(ctx).First(&invitation, "email = ? AND workspace_id = ? AND accepted_at IS NULL", email, workspaceID).Error; err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (r *invitationRepo) FindPendingByWorkspaceID(ctx context.Context, workspaceID string) ([]domain.Invitation, error) {
	var invitations []domain.Invitation
	err := r.db.WithContext(ctx).
		Where("workspace_id = ? AND accepted_at IS NULL AND expires_at > NOW()", workspaceID).
		Order("created_at DESC").
		Find(&invitations).Error
	if err != nil {
		return nil, err
	}
	return invitations, nil
}

func (r *invitationRepo) Cancel(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&domain.Invitation{}).Error
}

func (r *invitationRepo) AddWorkspaceMember(ctx context.Context, member *domain.WorkspaceMember) error {
	// Create a new record in workspace_members table (GORM automatically inserts to workspace_members)
	return r.db.WithContext(ctx).Table("workspace_members").Create(member).Error
}
