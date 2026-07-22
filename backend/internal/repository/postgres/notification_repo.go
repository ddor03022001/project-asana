package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type notificationRepo struct {
	db *gorm.DB
}

// NewNotificationRepository creates a GORM-based NotificationRepository instance
func NewNotificationRepository(db *gorm.DB) domain.NotificationRepository {
	return &notificationRepo{db: db}
}

func (r *notificationRepo) Create(ctx context.Context, notification *domain.Notification) error {
	return r.db.WithContext(ctx).Create(notification).Error
}

func (r *notificationRepo) FindAllByUserID(ctx context.Context, userID string, limit int, offset int) ([]domain.Notification, error) {
	var notifications []domain.Notification
	if limit <= 0 {
		limit = 20
	}
	err := r.db.WithContext(ctx).
		Table("notifications").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&notifications).Error
	if err != nil {
		return nil, err
	}
	return notifications, nil
}

func (r *notificationRepo) MarkAsRead(ctx context.Context, id string, userID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *notificationRepo) MarkAllAsRead(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}

func (r *notificationRepo) GetUnreadCount(ctx context.Context, userID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}
