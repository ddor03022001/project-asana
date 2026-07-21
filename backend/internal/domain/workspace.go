package domain

import (
	"context"
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

// WorkspaceMemberDetailed joins member data with user details for client views
type WorkspaceMemberDetailed struct {
	WorkspaceMember
	UserName   string `json:"user_name"`
	UserEmail  string `json:"user_email"`
	UserAvatar string `json:"user_avatar"`
}

// WorkspaceRepository defines database interactions for workspaces and their members
type WorkspaceRepository interface {
	Create(ctx context.Context, ws *Workspace) error
	FindByID(ctx context.Context, id string) (*Workspace, error)
	FindBySlug(ctx context.Context, slug string) (*Workspace, error)
	FindAllByUserID(ctx context.Context, userID string) ([]Workspace, error)
	Update(ctx context.Context, ws *Workspace) error
	Delete(ctx context.Context, id string) error
	FindMember(ctx context.Context, workspaceID string, userID string) (*WorkspaceMember, error)
	FindMembersDetailed(ctx context.Context, workspaceID string) ([]WorkspaceMemberDetailed, error)
	UpdateMemberRole(ctx context.Context, workspaceID string, userID string, role string) error
	RemoveMember(ctx context.Context, workspaceID string, userID string) error
}

