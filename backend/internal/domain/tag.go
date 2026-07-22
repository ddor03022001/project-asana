package domain

import (
	"context"
	"time"
)

// Tag represents a colored label within a workspace
type Tag struct {
	ID          string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	WorkspaceID string    `json:"workspace_id" gorm:"type:uuid;not null;column:workspace_id"`
	Name        string    `json:"name" gorm:"not null;size:100"`
	Color       string    `json:"color" gorm:"not null;size:50;default:'#6366f1'"`
	CreatedAt   time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// TaskTag represents the join table linking tasks and tags
type TaskTag struct {
	TaskID string `json:"task_id" gorm:"type:uuid;primaryKey;column:task_id"`
	TagID  string `json:"tag_id" gorm:"type:uuid;primaryKey;column:tag_id"`
}

// TagRepository defines GORM data access methods for workspace tags and task tag associations
type TagRepository interface {
	Create(ctx context.Context, tag *Tag) error
	FindByID(ctx context.Context, id string) (*Tag, error)
	FindAllByWorkspaceID(ctx context.Context, workspaceID string) ([]Tag, error)
	Delete(ctx context.Context, id string) error
	
	// Task tag mapping operations
	AttachToTask(ctx context.Context, taskID string, tagID string) error
	DetachFromTask(ctx context.Context, taskID string, tagID string) error
	FindAllByTaskID(ctx context.Context, taskID string) ([]Tag, error)
}
