package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type CreateProjectRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color" binding:"required"`
	Icon  string `json:"icon" binding:"required"`
}

type UpdateProjectRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color" binding:"required"`
	Icon  string `json:"icon" binding:"required"`
}

type AddProjectMemberRequest struct {
	UserID string `json:"user_id" binding:"required"`
}

// ProjectService defines business logic for workspaces projects
type ProjectService interface {
	CreateProject(ctx context.Context, workspaceID string, userID string, req CreateProjectRequest) (*domain.Project, error)
	GetProjects(ctx context.Context, workspaceID string, userID string) ([]domain.Project, error)
	GetProjectByID(ctx context.Context, id string) (*domain.Project, error)
	UpdateProject(ctx context.Context, id string, req UpdateProjectRequest) (*domain.Project, error)
	DeleteProject(ctx context.Context, id string) error
	AddMember(ctx context.Context, id string, userID string) error
	RemoveMember(ctx context.Context, id string, userID string) error
	GetMembers(ctx context.Context, id string) ([]domain.ProjectMemberDetailed, error)
}

type projectService struct {
	db          *gorm.DB
	projectRepo domain.ProjectRepository
}

// NewProjectService instantiates a new ProjectService
func NewProjectService(db *gorm.DB, projectRepo domain.ProjectRepository) ProjectService {
	return &projectService{
		db:          db,
		projectRepo: projectRepo,
	}
}

func (s *projectService) CreateProject(ctx context.Context, workspaceID string, userID string, req CreateProjectRequest) (*domain.Project, error) {
	// Begin transaction to ensure consistency
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	project := &domain.Project{
		WorkspaceID: workspaceID,
		Name:        req.Name,
		Color:       req.Color,
		Icon:        req.Icon,
		CreatedBy:   userID,
	}

	// 1. Create project row
	if err := tx.Create(project).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to save project: %w", err)
	}

	// 2. Add creator to project_members
	member := &domain.ProjectMember{
		ProjectID: project.ID,
		UserID:    userID,
		JoinedAt:  time.Now(),
	}

	if err := tx.Create(member).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to add creator to project members: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return project, nil
}

func (s *projectService) GetProjects(ctx context.Context, workspaceID string, userID string) ([]domain.Project, error) {
	return s.projectRepo.FindAllByWorkspaceID(ctx, workspaceID, userID)
}

func (s *projectService) GetProjectByID(ctx context.Context, id string) (*domain.Project, error) {
	return s.projectRepo.FindByID(ctx, id)
}

func (s *projectService) UpdateProject(ctx context.Context, id string, req UpdateProjectRequest) (*domain.Project, error) {
	project, err := s.projectRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("project not found")
	}

	project.Name = req.Name
	project.Color = req.Color
	project.Icon = req.Icon
	project.UpdatedAt = time.Now()

	if err := s.projectRepo.Update(ctx, project); err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}

	return project, nil
}

func (s *projectService) DeleteProject(ctx context.Context, id string) error {
	if _, err := s.projectRepo.FindByID(ctx, id); err != nil {
		return errors.New("project not found")
	}
	return s.projectRepo.Delete(ctx, id)
}

func (s *projectService) AddMember(ctx context.Context, projectID string, userID string) error {
	// Verify if user is already a member
	isMem, err := s.projectRepo.IsMember(ctx, projectID, userID)
	if err != nil {
		return err
	}
	if isMem {
		return errors.New("user is already a member of this project")
	}

	member := &domain.ProjectMember{
		ProjectID: projectID,
		UserID:    userID,
		JoinedAt:  time.Now(),
	}

	return s.projectRepo.AddMember(ctx, member)
}

func (s *projectService) RemoveMember(ctx context.Context, projectID string, userID string) error {
	isMem, err := s.projectRepo.IsMember(ctx, projectID, userID)
	if err != nil {
		return err
	}
	if !isMem {
		return errors.New("user is not a member of this project")
	}

	// Optional check: don't allow removing the project creator or ensure at least one member remains
	return s.projectRepo.RemoveMember(ctx, projectID, userID)
}

func (s *projectService) GetMembers(ctx context.Context, projectID string) ([]domain.ProjectMemberDetailed, error) {
	return s.projectRepo.FindMembersDetailed(ctx, projectID)
}
