package domain

import (
	"context"
	"time"
)

// Invitation represents an email invite sent to a user to join a workspace
type Invitation struct {
	ID          string     `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Email       string     `json:"email" gorm:"not null;size:255"`
	WorkspaceID string     `json:"workspace_id" gorm:"type:uuid;not null;column:workspace_id"`
	Role        string     `json:"role" gorm:"not null;size:50;default:'member'"` // admin, member
	Token       string     `json:"token" gorm:"uniqueIndex;not null;size:255"`
	ExpiresAt   time.Time  `json:"expires_at" gorm:"not null"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	CreatedBy   string     `json:"created_by" gorm:"type:uuid;not null;column:created_by"`
	CreatedAt   time.Time  `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`

	// Relational fields (for preload / convenience)
	Workspace   *Workspace `json:"workspace,omitempty" gorm:"foreignKey:WorkspaceID"`
}

// InvitationRepository defines the methods to persist and retrieve invitations in database
type InvitationRepository interface {
	Create(ctx context.Context, invitation *Invitation) error
	GetByToken(ctx context.Context, token string) (*Invitation, error)
	Accept(ctx context.Context, token string) error
	GetByEmailAndWorkspace(ctx context.Context, email string, workspaceID string) (*Invitation, error)
	FindPendingByWorkspaceID(ctx context.Context, workspaceID string) ([]Invitation, error)
	Cancel(ctx context.Context, id string) error
	AddWorkspaceMember(ctx context.Context, member *WorkspaceMember) error
}
