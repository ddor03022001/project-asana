package domain

import (
	"context"
	"time"
)

// Comment represents a message left by a user on a task
type Comment struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	TaskID    string    `json:"task_id" gorm:"type:uuid;not null;column:task_id"`
	UserID    string    `json:"user_id" gorm:"type:uuid;not null;column:user_id"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// CommentDetailed includes author profile info for UI rendering
type CommentDetailed struct {
	Comment
	UserName   string `json:"user_name"`
	UserEmail  string `json:"user_email"`
	UserAvatar string `json:"user_avatar"`
}

// CommentRepository defines GORM data access methods for task comments
type CommentRepository interface {
	Create(ctx context.Context, comment *Comment) error
	FindByID(ctx context.Context, id string) (*CommentDetailed, error)
	FindAllByTaskID(ctx context.Context, taskID string) ([]CommentDetailed, error)
	Delete(ctx context.Context, id string) error
}
