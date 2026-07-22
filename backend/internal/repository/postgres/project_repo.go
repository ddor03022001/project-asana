package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type projectRepo struct {
	db *gorm.DB
}

// NewProjectRepository creates a GORM-based ProjectRepository instance
func NewProjectRepository(db *gorm.DB) domain.ProjectRepository {
	return &projectRepo{db: db}
}

func (r *projectRepo) Create(ctx context.Context, project *domain.Project) error {
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *projectRepo) FindByID(ctx context.Context, id string) (*domain.Project, error) {
	var project domain.Project
	if err := r.db.WithContext(ctx).First(&project, "id = ? AND archived_at IS NULL", id).Error; err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *projectRepo) FindAllByWorkspaceID(ctx context.Context, workspaceID string, userID string) ([]domain.Project, error) {
	var projects []domain.Project
	err := r.db.WithContext(ctx).
		Table("projects").
		Where("workspace_id = ? AND archived_at IS NULL", workspaceID).
		Order("created_at ASC").
		Find(&projects).Error
	if err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *projectRepo) Update(ctx context.Context, project *domain.Project) error {
	return r.db.WithContext(ctx).Save(project).Error
}

func (r *projectRepo) Delete(ctx context.Context, id string) error {
	// Instead of hard deleting, we archive the project (Soft Delete) by setting archived_at
	// This is safe and preserves data integrity.
	return r.db.WithContext(ctx).
		Table("projects").
		Where("id = ?", id).
		Update("archived_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}

func (r *projectRepo) AddMember(ctx context.Context, member *domain.ProjectMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *projectRepo) RemoveMember(ctx context.Context, projectID string, userID string) error {
	return r.db.WithContext(ctx).
		Table("project_members").
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Delete(&domain.ProjectMember{}).Error
}

func (r *projectRepo) FindMembersDetailed(ctx context.Context, projectID string) ([]domain.ProjectMemberDetailed, error) {
	var members []domain.ProjectMemberDetailed
	err := r.db.WithContext(ctx).
		Table("project_members").
		Select("project_members.*, users.name as user_name, users.email as user_email, users.avatar_url as user_avatar").
		Joins("JOIN users ON users.id = project_members.user_id").
		Where("project_members.project_id = ?", projectID).
		Find(&members).Error
	if err != nil {
		return nil, err
	}
	return members, nil
}

func (r *projectRepo) IsMember(ctx context.Context, projectID string, userID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("project_members").
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
