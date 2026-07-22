package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type commentRepo struct {
	db *gorm.DB
}

// NewCommentRepository creates a GORM-based CommentRepository instance
func NewCommentRepository(db *gorm.DB) domain.CommentRepository {
	return &commentRepo{db: db}
}

func (r *commentRepo) Create(ctx context.Context, comment *domain.Comment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *commentRepo) FindByID(ctx context.Context, id string) (*domain.CommentDetailed, error) {
	var comment domain.CommentDetailed
	err := r.db.WithContext(ctx).
		Table("comments").
		Select("comments.*, users.name as user_name, users.email as user_email, users.avatar_url as user_avatar").
		Joins("JOIN users ON users.id = comments.user_id").
		Where("comments.id = ?", id).
		First(&comment).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *commentRepo) FindAllByTaskID(ctx context.Context, taskID string) ([]domain.CommentDetailed, error) {
	var comments []domain.CommentDetailed
	err := r.db.WithContext(ctx).
		Table("comments").
		Select("comments.*, users.name as user_name, users.email as user_email, users.avatar_url as user_avatar").
		Joins("JOIN users ON users.id = comments.user_id").
		Where("comments.task_id = ?", taskID).
		Order("comments.created_at ASC").
		Find(&comments).Error
	if err != nil {
		return nil, err
	}
	return comments, nil
}

func (r *commentRepo) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Comment{}, "id = ?", id).Error
}
