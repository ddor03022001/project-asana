package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type tagRepo struct {
	db *gorm.DB
}

// NewTagRepository creates a GORM-based TagRepository instance
func NewTagRepository(db *gorm.DB) domain.TagRepository {
	return &tagRepo{db: db}
}

func (r *tagRepo) Create(ctx context.Context, tag *domain.Tag) error {
	return r.db.WithContext(ctx).Create(tag).Error
}

func (r *tagRepo) FindByID(ctx context.Context, id string) (*domain.Tag, error) {
	var tag domain.Tag
	if err := r.db.WithContext(ctx).First(&tag, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &tag, nil
}

func (r *tagRepo) FindAllByWorkspaceID(ctx context.Context, workspaceID string) ([]domain.Tag, error) {
	var tags []domain.Tag
	err := r.db.WithContext(ctx).
		Table("tags").
		Where("workspace_id = ?", workspaceID).
		Order("name ASC").
		Find(&tags).Error
	if err != nil {
		return nil, err
	}
	return tags, nil
}

func (r *tagRepo) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Tag{}, "id = ?", id).Error
}

func (r *tagRepo) AttachToTask(ctx context.Context, taskID string, tagID string) error {
	taskTag := &domain.TaskTag{
		TaskID: taskID,
		TagID:  tagID,
	}
	return r.db.WithContext(ctx).Create(taskTag).Error
}

func (r *tagRepo) DetachFromTask(ctx context.Context, taskID string, tagID string) error {
	return r.db.WithContext(ctx).
		Where("task_id = ? AND tag_id = ?", taskID, tagID).
		Delete(&domain.TaskTag{}).Error
}

func (r *tagRepo) FindAllByTaskID(ctx context.Context, taskID string) ([]domain.Tag, error) {
	var tags []domain.Tag
	err := r.db.WithContext(ctx).
		Table("tags").
		Joins("JOIN task_tags ON task_tags.tag_id = tags.id").
		Where("task_tags.task_id = ?", taskID).
		Order("tags.name ASC").
		Find(&tags).Error
	if err != nil {
		return nil, err
	}
	return tags, nil
}
