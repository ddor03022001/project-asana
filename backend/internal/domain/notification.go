package domain

import (
	"context"
	"time"
)

// Notification types
const (
	NotificationTypeTaskAssigned = "task_assigned"
	NotificationTypeCommentAdded = "comment_added"
)

// Notification represents a real-time system or activity notification for a user
type Notification struct {
	ID            string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	UserID        string    `json:"user_id" gorm:"type:uuid;not null;column:user_id"`
	Type          string    `json:"type" gorm:"not null;size:50"`
	Content       string    `json:"content" gorm:"type:text;not null"`
	RelatedTaskID *string   `json:"related_task_id,omitempty" gorm:"type:uuid;column:related_task_id"`
	IsRead        bool      `json:"is_read" gorm:"not null;default:false;column:is_read"`
	CreatedAt     time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// NotificationRepository defines GORM data access methods for notifications
type NotificationRepository interface {
	Create(ctx context.Context, notification *Notification) error
	FindAllByUserID(ctx context.Context, userID string, limit int, offset int) ([]Notification, error)
	MarkAsRead(ctx context.Context, id string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	GetUnreadCount(ctx context.Context, userID string) (int64, error)
}
