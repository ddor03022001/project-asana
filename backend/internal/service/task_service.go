package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"backend/internal/domain"
)

// Request payloads for Task APIs
type CreateTaskRequest struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	Status      string     `json:"status"`   // defaults to 'todo'
	Priority    string     `json:"priority"` // defaults to 'medium'
	DueDate     *time.Time `json:"due_date"`
	AssigneeID  *string    `json:"assignee_id"`
}

type UpdateTaskRequest struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	Priority    string     `json:"priority" binding:"required,oneof=low medium high"`
	DueDate     *time.Time `json:"due_date"`
	AssigneeID  *string    `json:"assignee_id"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=todo in_progress done"`
}

type UpdateTaskPositionRequest struct {
	PrevPosition *float64 `json:"prev_position"`
	NextPosition *float64 `json:"next_position"`
	Status       string   `json:"status"` // optional, in case of column changes
}

type CreateSubtaskRequest struct {
	Title string `json:"title" binding:"required"`
}

type UpdateSubtaskRequest struct {
	Title  string `json:"title"`
	IsDone *bool  `json:"is_done"`
}

// TaskService defines task & subtask workflow logic
type TaskService interface {
	CreateTask(ctx context.Context, workspaceID string, projectID string, req CreateTaskRequest) (*domain.Task, error)
	GetTasks(ctx context.Context, projectID string, filters map[string]interface{}) ([]domain.Task, error)
	GetTaskByID(ctx context.Context, id string) (*domain.Task, error)
	UpdateTask(ctx context.Context, id string, req UpdateTaskRequest) (*domain.Task, error)
	DeleteTask(ctx context.Context, id string) error
	UpdateTaskStatus(ctx context.Context, id string, req UpdateTaskStatusRequest) (*domain.Task, error)
	UpdateTaskPosition(ctx context.Context, id string, req UpdateTaskPositionRequest) (*domain.Task, error)
	
	// Subtasks logic
	CreateSubtask(ctx context.Context, taskID string, req CreateSubtaskRequest) (*domain.Subtask, error)
	GetSubtasks(ctx context.Context, taskID string) ([]domain.Subtask, error)
	UpdateSubtask(ctx context.Context, id string, req UpdateSubtaskRequest) (*domain.Subtask, error)
	DeleteSubtask(ctx context.Context, id string) error
}

type taskService struct {
	taskRepo domain.TaskRepository
}

// NewTaskService instantiates a new TaskService
func NewTaskService(taskRepo domain.TaskRepository) TaskService {
	return &taskService{
		taskRepo: taskRepo,
	}
}

func (s *taskService) CreateTask(ctx context.Context, workspaceID string, projectID string, req CreateTaskRequest) (*domain.Task, error) {
	status := req.Status
	if status == "" {
		status = "todo"
	}
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	// Calculate position: append to bottom of column (highest position + 65536)
	highestPos, err := s.taskRepo.GetHighestPosition(ctx, projectID, status)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch column positions: %w", err)
	}

	task := &domain.Task{
		WorkspaceID: workspaceID,
		ProjectID:   projectID,
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
		Priority:    priority,
		DueDate:     req.DueDate,
		AssigneeID:  req.AssigneeID,
		Position:    highestPos + 65536.0,
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to save task: %w", err)
	}

	return task, nil
}

func (s *taskService) GetTasks(ctx context.Context, projectID string, filters map[string]interface{}) ([]domain.Task, error) {
	return s.taskRepo.FindAllByProjectID(ctx, projectID, filters)
}

func (s *taskService) GetTaskByID(ctx context.Context, id string) (*domain.Task, error) {
	return s.taskRepo.FindByID(ctx, id)
}

func (s *taskService) UpdateTask(ctx context.Context, id string, req UpdateTaskRequest) (*domain.Task, error) {
	task, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("task not found")
	}

	task.Title = req.Title
	task.Description = req.Description
	task.Priority = req.Priority
	task.DueDate = req.DueDate
	task.AssigneeID = req.AssigneeID
	task.UpdatedAt = time.Now()

	if err := s.taskRepo.Update(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to save task updates: %w", err)
	}

	return task, nil
}

func (s *taskService) DeleteTask(ctx context.Context, id string) error {
	if _, err := s.taskRepo.FindByID(ctx, id); err != nil {
		return errors.New("task not found")
	}
	return s.taskRepo.Delete(ctx, id)
}

func (s *taskService) UpdateTaskStatus(ctx context.Context, id string, req UpdateTaskStatusRequest) (*domain.Task, error) {
	task, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("task not found")
	}

	if task.Status != req.Status {
		// Moving columns: append to the bottom of the destination column
		highestPos, err := s.taskRepo.GetHighestPosition(ctx, task.ProjectID, req.Status)
		if err != nil {
			return nil, err
		}
		task.Status = req.Status
		task.Position = highestPos + 65536.0
		task.UpdatedAt = time.Now()

		if err := s.taskRepo.Update(ctx, task); err != nil {
			return nil, err
		}
	}

	return task, nil
}

func (s *taskService) UpdateTaskPosition(ctx context.Context, id string, req UpdateTaskPositionRequest) (*domain.Task, error) {
	task, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("task not found")
	}

	// Update status column if changed during drag-and-drop
	if req.Status != "" && req.Status != task.Status {
		task.Status = req.Status
	}

	// Apply Fractional Indexing logic
	var newPos float64
	if req.PrevPosition != nil && req.NextPosition != nil {
		// Placed in between two cards
		newPos = (*req.PrevPosition + *req.NextPosition) / 2.0
	} else if req.PrevPosition != nil {
		// Placed at the bottom of the column
		newPos = *req.PrevPosition + 65536.0
	} else if req.NextPosition != nil {
		// Placed at the top of the column
		newPos = *req.NextPosition / 2.0
	} else {
		// Fallback for empty column placement
		newPos = 65536.0
	}

	task.Position = newPos
	task.UpdatedAt = time.Now()

	if err := s.taskRepo.Update(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to save task position update: %w", err)
	}

	return task, nil
}

// Subtask Service operations

func (s *taskService) CreateSubtask(ctx context.Context, taskID string, req CreateSubtaskRequest) (*domain.Subtask, error) {
	// Verify task exists
	if _, err := s.taskRepo.FindByID(ctx, taskID); err != nil {
		return nil, errors.New("parent task not found")
	}

	// Append to the bottom
	highestPos, err := s.taskRepo.GetHighestSubtaskPosition(ctx, taskID)
	if err != nil {
		return nil, err
	}

	subtask := &domain.Subtask{
		TaskID:   taskID,
		Title:    req.Title,
		IsDone:   false,
		Position: highestPos + 65536.0,
	}

	if err := s.taskRepo.CreateSubtask(ctx, subtask); err != nil {
		return nil, err
	}

	return subtask, nil
}

func (s *taskService) GetSubtasks(ctx context.Context, taskID string) ([]domain.Subtask, error) {
	return s.taskRepo.FindSubtasksByTaskID(ctx, taskID)
}

func (s *taskService) UpdateSubtask(ctx context.Context, id string, req UpdateSubtaskRequest) (*domain.Subtask, error) {
	subtask, err := s.taskRepo.FindSubtaskByID(ctx, id)
	if err != nil {
		return nil, errors.New("subtask not found")
	}

	if req.Title != "" {
		subtask.Title = req.Title
	}
	if req.IsDone != nil {
		subtask.IsDone = *req.IsDone
	}
	subtask.UpdatedAt = time.Now()

	if err := s.taskRepo.UpdateSubtask(ctx, subtask); err != nil {
		return nil, err
	}

	return subtask, nil
}

func (s *taskService) DeleteSubtask(ctx context.Context, id string) error {
	if _, err := s.taskRepo.FindSubtaskByID(ctx, id); err != nil {
		return errors.New("subtask not found")
	}
	return s.taskRepo.DeleteSubtask(ctx, id)
}
