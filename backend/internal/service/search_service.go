package service

import (
	"context"

	"backend/internal/domain"

	"gorm.io/gorm"
)

type SearchService interface {
	Search(ctx context.Context, workspaceID string, userID string, query string) (*domain.SearchResponse, error)
}

type searchService struct {
	db         *gorm.DB
	searchRepo domain.SearchRepository
}

func NewSearchService(db *gorm.DB, searchRepo domain.SearchRepository) SearchService {
	return &searchService{
		db:         db,
		searchRepo: searchRepo,
	}
}

func (s *searchService) Search(ctx context.Context, workspaceID string, userID string, query string) (*domain.SearchResponse, error) {
	if query == "" {
		return &domain.SearchResponse{
			Projects: []domain.SearchResultProject{},
			Tasks:    []domain.SearchResultTask{},
		}, nil
	}

	// Determine workspace role
	var member struct {
		Role string
	}
	isOwnerOrAdmin := false
	err := s.db.WithContext(ctx).
		Table("workspace_members").
		Select("role").
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		First(&member).Error

	if err == nil && (member.Role == "owner" || member.Role == "admin") {
		isOwnerOrAdmin = true
	}

	projects, err := s.searchRepo.SearchProjects(ctx, workspaceID, userID, isOwnerOrAdmin, query)
	if err != nil {
		projects = []domain.SearchResultProject{}
	}

	tasks, err := s.searchRepo.SearchTasks(ctx, workspaceID, userID, isOwnerOrAdmin, query)
	if err != nil {
		tasks = []domain.SearchResultTask{}
	}

	return &domain.SearchResponse{
		Projects: projects,
		Tasks:    tasks,
	}, nil
}
