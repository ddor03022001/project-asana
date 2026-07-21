package domain

import (
	"context"
	"time"
)

// Task represents a work item inside a project
type Task struct {
	ID          string     `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	WorkspaceID string     `json:"workspace_id" gorm:"type:uuid;not null;column:workspace_id"`
	ProjectID   string     `json:"project_id" gorm:"type:uuid;not null;column:project_id"`
	Title       string     `json:"title" gorm:"not null;size:255"`
	Description string     `json:"description" gorm:"type:text"`
	Status      string     `json:"status" gorm:"not null;size:50;default:'todo'"`     // todo, in_progress, done
	Priority    string     `json:"priority" gorm:"not null;size:50;default:'medium'"` // low, medium, high
	DueDate     *time.Time `json:"due_date,omitempty" gorm:"column:due_date"`
	AssigneeID  *string    `json:"assignee_id,omitempty" gorm:"type:uuid;column:assignee_id"`
	Position    float64    `json:"position" gorm:"not null;type:double precision"`
	ArchivedAt  *time.Time `json:"archived_at,omitempty" gorm:"column:archived_at"`
	CreatedAt   time.Time  `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`

	// Relational fields (GORM Preload support)
	Assignee *User `json:"assignee,omitempty" gorm:"foreignKey:AssigneeID"`
}

// Subtask represents a small checklist item inside a Task
type Subtask struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	TaskID    string    `json:"task_id" gorm:"type:uuid;not null;column:task_id"`
	Title     string    `json:"title" gorm:"not null;size:255"`
	IsDone    bool      `json:"is_done" gorm:"not null;default:false;column:is_done"`
	Position  float64   `json:"position" gorm:"not null;type:double precision"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// TaskRepository defines PostgreSQL database access methods for tasks
type TaskRepository interface {
	Create(ctx context.Context, task *Task) error
	FindByID(ctx context.Context, id string) (*Task, error)
	FindAllByProjectID(ctx context.Context, projectID string, filters map[string]interface{}) ([]Task, error)
	Update(ctx context.Context, task *Task) error
	Delete(ctx context.Context, id string) error
	GetHighestPosition(ctx context.Context, projectID string, status string) (float64, error)
	
	// Subtasks database operations
	CreateSubtask(ctx context.Context, subtask *Subtask) error
	FindSubtaskByID(ctx context.Context, id string) (*Subtask, error)
	FindSubtasksByTaskID(ctx context.Context, taskID string) ([]Subtask, error)
	UpdateSubtask(ctx context.Context, subtask *Subtask) error
	DeleteSubtask(ctx context.Context, id string) error
	GetHighestSubtaskPosition(ctx context.Context, taskID string) (float64, error)
}
