package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/internal/domain"

	"gorm.io/gorm"
)

// Request payloads for Workspace APIs
type CreateWorkspaceRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateWorkspaceRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin member"`
}

// WorkspaceService handles CRUD operations for workspaces and member administration
type WorkspaceService interface {
	CreateWorkspace(ctx context.Context, userID string, req CreateWorkspaceRequest) (*domain.Workspace, error)
	GetWorkspaces(ctx context.Context, userID string) ([]domain.Workspace, error)
	GetWorkspaceByID(ctx context.Context, workspaceID string) (*domain.Workspace, error)
	UpdateWorkspace(ctx context.Context, workspaceID string, req UpdateWorkspaceRequest) (*domain.Workspace, error)
	DeleteWorkspace(ctx context.Context, workspaceID string) error
	GetMembers(ctx context.Context, workspaceID string) ([]domain.WorkspaceMemberDetailed, error)
	UpdateMemberRole(ctx context.Context, workspaceID string, userID string, req UpdateMemberRoleRequest) error
	RemoveMember(ctx context.Context, workspaceID string, userID string) error
}

type workspaceService struct {
	db            *gorm.DB
	workspaceRepo domain.WorkspaceRepository
}

// NewWorkspaceService instantiates a new WorkspaceService
func NewWorkspaceService(db *gorm.DB, workspaceRepo domain.WorkspaceRepository) WorkspaceService {
	return &workspaceService{
		db:            db,
		workspaceRepo: workspaceRepo,
	}
}

func (s *workspaceService) CreateWorkspace(ctx context.Context, userID string, req CreateWorkspaceRequest) (*domain.Workspace, error) {
	// Generate base slug
	baseSlug := slugify(req.Name)
	if baseSlug == "" {
		baseSlug = "workspace"
	}

	// Ensure slug is unique in PostgreSQL
	uniqueSlug := baseSlug
	counter := 1
	for {
		existing, err := s.workspaceRepo.FindBySlug(ctx, uniqueSlug)
		if err != nil || existing == nil {
			break
		}
		uniqueSlug = fmt.Sprintf("%s-%d", baseSlug, counter)
		counter++
	}

	// Begin database transaction for dual workspace + owner insert
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	ws := &domain.Workspace{
		Name:    req.Name,
		Slug:    uniqueSlug,
		OwnerID: userID,
	}

	// 1. Create workspace
	if err := tx.Create(ws).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to save workspace: %w", err)
	}

	// 2. Add creator as workspace owner
	member := &domain.WorkspaceMember{
		WorkspaceID: ws.ID,
		UserID:      userID,
		Role:        "owner",
		JoinedAt:    time.Now(),
	}
	if err := tx.Table("workspace_members").Create(member).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to register workspace owner: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return ws, nil
}

func (s *workspaceService) GetWorkspaces(ctx context.Context, userID string) ([]domain.Workspace, error) {
	return s.workspaceRepo.FindAllByUserID(ctx, userID)
}

func (s *workspaceService) GetWorkspaceByID(ctx context.Context, workspaceID string) (*domain.Workspace, error) {
	return s.workspaceRepo.FindByID(ctx, workspaceID)
}

func (s *workspaceService) UpdateWorkspace(ctx context.Context, workspaceID string, req UpdateWorkspaceRequest) (*domain.Workspace, error) {
	ws, err := s.workspaceRepo.FindByID(ctx, workspaceID)
	if err != nil {
		return nil, errors.New("workspace not found")
	}

	ws.Name = req.Name
	ws.UpdatedAt = time.Now()

	if err := s.workspaceRepo.Update(ctx, ws); err != nil {
		return nil, fmt.Errorf("failed to update workspace: %w", err)
	}

	return ws, nil
}

func (s *workspaceService) DeleteWorkspace(ctx context.Context, workspaceID string) error {
	// Verify workspace exists
	if _, err := s.workspaceRepo.FindByID(ctx, workspaceID); err != nil {
		return errors.New("workspace not found")
	}
	return s.workspaceRepo.Delete(ctx, workspaceID)
}

func (s *workspaceService) GetMembers(ctx context.Context, workspaceID string) ([]domain.WorkspaceMemberDetailed, error) {
	return s.workspaceRepo.FindMembersDetailed(ctx, workspaceID)
}

func (s *workspaceService) UpdateMemberRole(ctx context.Context, workspaceID string, userID string, req UpdateMemberRoleRequest) error {
	ws, err := s.workspaceRepo.FindByID(ctx, workspaceID)
	if err != nil {
		return errors.New("workspace not found")
	}

	// Security Check: Workspace owner's role cannot be updated
	if ws.OwnerID == userID {
		return errors.New("cannot change the role of the workspace owner")
	}

	return s.workspaceRepo.UpdateMemberRole(ctx, workspaceID, userID, req.Role)
}

func (s *workspaceService) RemoveMember(ctx context.Context, workspaceID string, userID string) error {
	ws, err := s.workspaceRepo.FindByID(ctx, workspaceID)
	if err != nil {
		return errors.New("workspace not found")
	}

	// Security Check: Workspace owner cannot be removed from their own workspace
	if ws.OwnerID == userID {
		return errors.New("cannot remove the workspace owner from the workspace")
	}

	return s.workspaceRepo.RemoveMember(ctx, workspaceID, userID)
}

// slugify converts a string into a clean URL-friendly slug, supporting Vietnamese diacritics
func slugify(s string) string {
	var buf bytes.Buffer
	for _, r := range strings.ToLower(s) {
		switch r {
		case 'á', 'à', 'ả', 'ã', 'ạ', 'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ', 'â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ':
			buf.WriteByte('a')
		case 'é', 'è', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ':
			buf.WriteByte('e')
		case 'í', 'ì', 'ỉ', 'ĩ', 'ị':
			buf.WriteByte('i')
		case 'ó', 'ò', 'ỏ', 'õ', 'ọ', 'ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ', 'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ':
			buf.WriteByte('o')
		case 'ú', 'ù', 'ủ', 'ũ', 'ụ', 'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự':
			buf.WriteByte('u')
		case 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ':
			buf.WriteByte('y')
		case 'đ':
			buf.WriteByte('d')
		case ' ', '-', '_':
			buf.WriteByte('-')
		default:
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				buf.WriteRune(r)
			}
		}
	}
	// Clean double dashes
	slug := buf.String()
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	return strings.Trim(slug, "-")
}
