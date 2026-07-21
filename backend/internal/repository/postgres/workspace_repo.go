package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type workspaceRepo struct {
	db *gorm.DB
}

// NewWorkspaceRepository creates a GORM-based WorkspaceRepository instance
func NewWorkspaceRepository(db *gorm.DB) domain.WorkspaceRepository {
	return &workspaceRepo{db: db}
}

func (r *workspaceRepo) Create(ctx context.Context, ws *domain.Workspace) error {
	return r.db.WithContext(ctx).Create(ws).Error
}

func (r *workspaceRepo) FindByID(ctx context.Context, id string) (*domain.Workspace, error) {
	var ws domain.Workspace
	if err := r.db.WithContext(ctx).First(&ws, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &ws, nil
}

func (r *workspaceRepo) FindBySlug(ctx context.Context, slug string) (*domain.Workspace, error) {
	var ws domain.Workspace
	if err := r.db.WithContext(ctx).First(&ws, "slug = ?", slug).Error; err != nil {
		return nil, err
	}
	return &ws, nil
}

func (r *workspaceRepo) FindAllByUserID(ctx context.Context, userID string) ([]domain.Workspace, error) {
	var workspaces []domain.Workspace
	// Query workspaces through the workspace_members join table
	err := r.db.WithContext(ctx).
		Table("workspaces").
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ?", userID).
		Find(&workspaces).Error
	if err != nil {
		return nil, err
	}
	return workspaces, nil
}

func (r *workspaceRepo) Update(ctx context.Context, ws *domain.Workspace) error {
	return r.db.WithContext(ctx).Save(ws).Error
}

func (r *workspaceRepo) Delete(ctx context.Context, id string) error {
	// GORM Delete will trigger Soft Delete if the struct has deleted_at,
	// but here since domain.Workspace does not extend gorm.Model or have a gorm.DeletedAt field,
	// this acts as a hard delete database constraint. We can implement soft delete or hard delete.
	// For this MVP, we perform a direct table row deletion.
	return r.db.WithContext(ctx).Delete(&domain.Workspace{}, "id = ?", id).Error
}

func (r *workspaceRepo) FindMember(ctx context.Context, workspaceID string, userID string) (*domain.WorkspaceMember, error) {
	var member domain.WorkspaceMember
	err := r.db.WithContext(ctx).
		Table("workspace_members").
		First(&member, "workspace_id = ? AND user_id = ?", workspaceID, userID).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *workspaceRepo) FindMembersDetailed(ctx context.Context, workspaceID string) ([]domain.WorkspaceMemberDetailed, error) {
	var members []domain.WorkspaceMemberDetailed
	// Join workspace_members with users to pull name, email, and avatar
	err := r.db.WithContext(ctx).
		Table("workspace_members").
		Select("workspace_members.*, users.name as user_name, users.email as user_email, users.avatar_url as user_avatar").
		Joins("JOIN users ON users.id = workspace_members.user_id").
		Where("workspace_members.workspace_id = ?", workspaceID).
		Find(&members).Error
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (r *workspaceRepo) UpdateMemberRole(ctx context.Context, workspaceID string, userID string, role string) error {
	return r.db.WithContext(ctx).
		Table("workspace_members").
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Update("role", role).Error
}

func (r *workspaceRepo) RemoveMember(ctx context.Context, workspaceID string, userID string) error {
	return r.db.WithContext(ctx).
		Table("workspace_members").
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&domain.WorkspaceMember{}).Error
}
