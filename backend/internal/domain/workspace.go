package domain

import (
	"time"
)

// Workspace represents a company or team tenant
type Workspace struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Name      string    `json:"name" gorm:"not null;size:255"`
	Slug      string    `json:"slug" gorm:"uniqueIndex;not null;size:255"`
	OwnerID   string    `json:"owner_id" gorm:"type:uuid;not null;column:owner_id"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// WorkspaceMember links a user to a workspace with a specific role
type WorkspaceMember struct {
	ID          string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	WorkspaceID string    `json:"workspace_id" gorm:"type:uuid;uniqueIndex:idx_ws_user;column:workspace_id"`
	UserID      string    `json:"user_id" gorm:"type:uuid;uniqueIndex:idx_ws_user;column:user_id"`
	Role        string    `json:"role" gorm:"not null;size:50;default:'member'"` // owner, admin, member
	JoinedAt    time.Time `json:"joined_at" gorm:"default:CURRENT_TIMESTAMP"`
}
