package domain

import (
	"context"
	"time"
)

// User represents a user in the application database
type User struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Email     string    `json:"email" gorm:"uniqueIndex;not null;size:255"`
	Name      string    `json:"name" gorm:"not null;size:255"`
	AvatarURL string    `json:"avatar_url" gorm:"column:avatar_url"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// UserRepository defines the methods that any user repository implementation must provide
type UserRepository interface {
	FindByID(ctx context.Context, id string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	Create(ctx context.Context, user *User) error
	Update(ctx context.Context, user *User) error
}
