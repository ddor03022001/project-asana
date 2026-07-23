package postgres

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type taskRepo struct {
	db *gorm.DB
}

// NewTaskRepository creates a GORM-based TaskRepository instance
func NewTaskRepository(db *gorm.DB) domain.TaskRepository {
	return &taskRepo{db: db}
}

func (r *taskRepo) Create(ctx context.Context, task *domain.Task) error {
	return r.db.WithContext(ctx).Create(task).Error
}

func (r *taskRepo) FindByID(ctx context.Context, id string) (*domain.Task, error) {
	var task domain.Task
	if err := r.db.WithContext(ctx).Preload("Assignee").First(&task, "id = ? AND archived_at IS NULL", id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *taskRepo) FindAllByProjectID(ctx context.Context, projectID string, filters map[string]interface{}) ([]domain.Task, error) {
	var tasks []domain.Task
	query := r.db.WithContext(ctx).
		Table("tasks").
		Preload("Assignee").
		Where("project_id = ? AND archived_at IS NULL", projectID)

	// Apply optional filters dynamically
	if status, ok := filters["status"]; ok && status != "" {
		query = query.Where("status = ?", status)
	}
	if assigneeID, ok := filters["assignee_id"]; ok && assigneeID != "" {
		query = query.Where("assignee_id = ?", assigneeID)
	}
	if priority, ok := filters["priority"]; ok && priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if from, ok := filters["from"]; ok && from != "" {
		query = query.Where("due_date >= ?", from)
	}
	if to, ok := filters["to"]; ok && to != "" {
		query = query.Where("due_date <= ?", to)
	}

	// Always retrieve sorted by position ascending
	err := query.Order("position ASC").Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *taskRepo) Update(ctx context.Context, task *domain.Task) error {
	if task.AssigneeID == nil {
		if err := r.db.WithContext(ctx).Table("tasks").Where("id = ?", task.ID).Update("assignee_id", nil).Error; err != nil {
			return err
		}
	}
	return r.db.WithContext(ctx).Model(task).Select("*").Omit("Assignee").Updates(task).Error
}

func (r *taskRepo) Delete(ctx context.Context, id string) error {
	// Archive the task (Soft Delete) by setting archived_at timestamp
	return r.db.WithContext(ctx).
		Table("tasks").
		Where("id = ?", id).
		Update("archived_at", gorm.Expr("CURRENT_TIMESTAMP")).Error
}

func (r *taskRepo) GetHighestPosition(ctx context.Context, projectID string, status string) (float64, error) {
	var result struct {
		MaxPos *float64 `gorm:"column:max_pos"`
	}
	err := r.db.WithContext(ctx).
		Table("tasks").
		Select("MAX(position) as max_pos").
		Where("project_id = ? AND status = ? AND archived_at IS NULL", projectID, status).
		Scan(&result).Error

	if err != nil {
		return 0, err
	}
	if result.MaxPos == nil {
		return 0, nil
	}
	return *result.MaxPos, nil
}

// Subtask GORM operations implementation

func (r *taskRepo) CreateSubtask(ctx context.Context, subtask *domain.Subtask) error {
	return r.db.WithContext(ctx).Create(subtask).Error
}

func (r *taskRepo) FindSubtaskByID(ctx context.Context, id string) (*domain.Subtask, error) {
	var subtask domain.Subtask
	if err := r.db.WithContext(ctx).First(&subtask, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &subtask, nil
}

func (r *taskRepo) FindSubtasksByTaskID(ctx context.Context, taskID string) ([]domain.Subtask, error) {
	var subtasks []domain.Subtask
	err := r.db.WithContext(ctx).
		Table("subtasks").
		Where("task_id = ?", taskID).
		Order("position ASC").
		Find(&subtasks).Error
	if err != nil {
		return nil, err
	}
	return subtasks, nil
}

func (r *taskRepo) UpdateSubtask(ctx context.Context, subtask *domain.Subtask) error {
	return r.db.WithContext(ctx).Save(subtask).Error
}

func (r *taskRepo) DeleteSubtask(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Subtask{}, "id = ?", id).Error
}

func (r *taskRepo) GetHighestSubtaskPosition(ctx context.Context, taskID string) (float64, error) {
	var result struct {
		MaxPos *float64 `gorm:"column:max_pos"`
	}
	err := r.db.WithContext(ctx).
		Table("subtasks").
		Select("MAX(position) as max_pos").
		Where("task_id = ?", taskID).
		Scan(&result).Error

	if err != nil {
		return 0, err
	}
	if result.MaxPos == nil {
		return 0, nil
	}
	return *result.MaxPos, nil
}
