package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type attachmentRepo struct {
	db *gorm.DB
}

// NewAttachmentRepository creates a GORM-based AttachmentRepository instance
func NewAttachmentRepository(db *gorm.DB) domain.AttachmentRepository {
	return &attachmentRepo{db: db}
}

func (r *attachmentRepo) Create(ctx context.Context, attachment *domain.Attachment) error {
	return r.db.WithContext(ctx).Create(attachment).Error
}

func (r *attachmentRepo) FindByID(ctx context.Context, id string) (*domain.Attachment, error) {
	var attachment domain.Attachment
	if err := r.db.WithContext(ctx).First(&attachment, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &attachment, nil
}

func (r *attachmentRepo) FindAllByTaskID(ctx context.Context, taskID string) ([]domain.Attachment, error) {
	var attachments []domain.Attachment
	err := r.db.WithContext(ctx).
		Table("attachments").
		Where("task_id = ?", taskID).
		Order("created_at DESC").
		Find(&attachments).Error
	if err != nil {
		return nil, err
	}
	return attachments, nil
}

func (r *attachmentRepo) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Attachment{}, "id = ?", id).Error
}
