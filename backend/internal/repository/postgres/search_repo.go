package postgres

import (
	"context"
	"fmt"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type searchRepo struct {
	db *gorm.DB
}

// NewSearchRepository creates a GORM-based SearchRepository instance
func NewSearchRepository(db *gorm.DB) domain.SearchRepository {
	return &searchRepo{db: db}
}

func (r *searchRepo) SearchProjects(ctx context.Context, workspaceID string, userID string, isOwnerOrAdmin bool, query string) ([]domain.SearchResultProject, error) {
	var projects []domain.SearchResultProject
	likePattern := fmt.Sprintf("%%%s%%", query)

	dbQuery := r.db.WithContext(ctx).
		Table("projects").
		Select("projects.id, projects.name, projects.color").
		Where("projects.workspace_id = ? AND projects.archived_at IS NULL AND projects.name ILIKE ?", workspaceID, likePattern)

	if !isOwnerOrAdmin {
		dbQuery = dbQuery.
			Joins("JOIN project_members ON project_members.project_id = projects.id").
			Where("project_members.user_id = ?", userID)
	}

	err := dbQuery.Limit(10).Find(&projects).Error
	if err != nil {
		return nil, err
	}

	return projects, nil
}

func (r *searchRepo) SearchTasks(ctx context.Context, workspaceID string, userID string, isOwnerOrAdmin bool, query string) ([]domain.SearchResultTask, error) {
	var tasks []domain.SearchResultTask
	likePattern := fmt.Sprintf("%%%s%%", query)

	dbQuery := r.db.WithContext(ctx).
		Table("tasks").
		Select("tasks.id, tasks.title, tasks.status, tasks.priority, tasks.project_id, projects.name as project_name").
		Joins("JOIN projects ON projects.id = tasks.project_id").
		Where("projects.workspace_id = ? AND tasks.archived_at IS NULL AND projects.archived_at IS NULL", workspaceID).
		Where("(tasks.title ILIKE ? OR tasks.description ILIKE ?)", likePattern, likePattern)

	if !isOwnerOrAdmin {
		dbQuery = dbQuery.Where("tasks.assignee_id = ?", userID)
	}

	err := dbQuery.Limit(15).Find(&tasks).Error
	if err != nil {
		return nil, err
	}

	return tasks, nil
}
