package service

import (
	"context"
	"errors"

	"backend/internal/domain"
)

type CreateTagRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color"`
}

type TagService interface {
	CreateTag(ctx context.Context, workspaceID string, req CreateTagRequest) (*domain.Tag, error)
	GetTagsByWorkspace(ctx context.Context, workspaceID string) ([]domain.Tag, error)
	DeleteTag(ctx context.Context, tagID string) error
	AttachTagToTask(ctx context.Context, taskID string, tagID string) error
	DetachTagFromTask(ctx context.Context, taskID string, tagID string) error
	GetTagsByTask(ctx context.Context, taskID string) ([]domain.Tag, error)
}

type tagService struct {
	tagRepo domain.TagRepository
}

func NewTagService(tagRepo domain.TagRepository) TagService {
	return &tagService{tagRepo: tagRepo}
}

func (s *tagService) CreateTag(ctx context.Context, workspaceID string, req CreateTagRequest) (*domain.Tag, error) {
	color := req.Color
	if color == "" {
		color = "#6366f1" // default indigo color
	}

	tag := &domain.Tag{
		WorkspaceID: workspaceID,
		Name:        req.Name,
		Color:       color,
	}

	if err := s.tagRepo.Create(ctx, tag); err != nil {
		return nil, err
	}
	return tag, nil
}

func (s *tagService) GetTagsByWorkspace(ctx context.Context, workspaceID string) ([]domain.Tag, error) {
	return s.tagRepo.FindAllByWorkspaceID(ctx, workspaceID)
}

func (s *tagService) DeleteTag(ctx context.Context, tagID string) error {
	if _, err := s.tagRepo.FindByID(ctx, tagID); err != nil {
		return errors.New("tag not found")
	}
	return s.tagRepo.Delete(ctx, tagID)
}

func (s *tagService) AttachTagToTask(ctx context.Context, taskID string, tagID string) error {
	return s.tagRepo.AttachToTask(ctx, taskID, tagID)
}

func (s *tagService) DetachTagFromTask(ctx context.Context, taskID string, tagID string) error {
	return s.tagRepo.DetachFromTask(ctx, taskID, tagID)
}

func (s *tagService) GetTagsByTask(ctx context.Context, taskID string) ([]domain.Tag, error) {
	return s.tagRepo.FindAllByTaskID(ctx, taskID)
}
