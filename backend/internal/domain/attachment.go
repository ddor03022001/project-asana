package domain

import (
	"context"
	"time"
)

// Attachment represents a file uploaded and linked to a task
type Attachment struct {
	ID         string    `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	TaskID     string    `json:"task_id" gorm:"type:uuid;not null;column:task_id"`
	UploadedBy *string   `json:"uploaded_by,omitempty" gorm:"type:uuid;column:uploaded_by"`
	FileName   string    `json:"file_name" gorm:"not null;size:255"`
	FileURL    string    `json:"file_url" gorm:"type:text;not null"`
	FileSize   int64     `json:"file_size" gorm:"not null"`
	MimeType   string    `json:"mime_type" gorm:"not null;size:100"`
	CreatedAt  time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// AttachmentRepository defines GORM data access methods for task attachments
type AttachmentRepository interface {
	Create(ctx context.Context, attachment *Attachment) error
	FindByID(ctx context.Context, id string) (*Attachment, error)
	FindAllByTaskID(ctx context.Context, taskID string) ([]Attachment, error)
	Delete(ctx context.Context, id string) error
}
