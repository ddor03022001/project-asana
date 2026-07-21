package domain

import (
	"context"
	"time"
)

// Project represents a workspace project board containing tasks
type Project struct {
	ID          string     `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	WorkspaceID string     `json:"workspace_id" gorm:"type:uuid;not null;column:workspace_id"`
	Name        string     `json:"name" gorm:"not null;size:255"`
	Color       string     `json:"color" gorm:"not null;size:50;default:'#4f46e5'"`
	Icon        string     `json:"icon" gorm:"not null;size:50;default:'folder'"`
	CreatedBy   string     `json:"created_by" gorm:"type:uuid;not null;column:created_by"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty" gorm:"column:archived_at"`
	CreatedAt   time.Time  `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// ProjectMember represents a user registered in a project
type ProjectMember struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	ProjectID string    `json:"project_id" gorm:"type:uuid;uniqueIndex:idx_pj_user;column:project_id"`
	UserID    string    `json:"user_id" gorm:"type:uuid;uniqueIndex:idx_pj_user;column:user_id"`
	JoinedAt  time.Time `json:"joined_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// ProjectMemberDetailed joins project member data with user details for lists
type ProjectMemberDetailed struct {
	ProjectMember
	UserName   string `json:"user_name"`
	UserEmail  string `json:"user_email"`
	UserAvatar string `json:"user_avatar"`
}

// ProjectRepository defines GORM database methods for projects and members
type ProjectRepository interface {
	Create(ctx context.Context, project *Project) error
	FindByID(ctx context.Context, id string) (*Project, error)
	FindAllByWorkspaceID(ctx context.Context, workspaceID string, userID string) ([]Project, error)
	Update(ctx context.Context, project *Project) error
	Delete(ctx context.Context, id string) error
	AddMember(ctx context.Context, member *ProjectMember) error
	RemoveMember(ctx context.Context, projectID string, userID string) error
	FindMembersDetailed(ctx context.Context, projectID string) ([]ProjectMemberDetailed, error)
	IsMember(ctx context.Context, projectID string, userID string) (bool, error)
}
