package service

import (
	"context"
	"errors"

	"backend/internal/domain"
)

type CreateCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

type CommentService interface {
	CreateComment(ctx context.Context, taskID string, userID string, req CreateCommentRequest) (*domain.CommentDetailed, error)
	GetComments(ctx context.Context, taskID string) ([]domain.CommentDetailed, error)
	DeleteComment(ctx context.Context, commentID string, userID string, isWorkspaceAdminOrOwner bool) error
}

type commentService struct {
	commentRepo domain.CommentRepository
}

func NewCommentService(commentRepo domain.CommentRepository) CommentService {
	return &commentService{commentRepo: commentRepo}
}

func (s *commentService) CreateComment(ctx context.Context, taskID string, userID string, req CreateCommentRequest) (*domain.CommentDetailed, error) {
	if req.Content == "" {
		return nil, errors.New("comment content cannot be empty")
	}

	comment := &domain.Comment{
		TaskID:  taskID,
		UserID:   userID,
		Content: req.Content,
	}

	if err := s.commentRepo.Create(ctx, comment); err != nil {
		return nil, err
	}

	// Fetch detailed comment with user metadata
	return s.commentRepo.FindByID(ctx, comment.ID)
}

func (s *commentService) GetComments(ctx context.Context, taskID string) ([]domain.CommentDetailed, error) {
	return s.commentRepo.FindAllByTaskID(ctx, taskID)
}

func (s *commentService) DeleteComment(ctx context.Context, commentID string, userID string, isWorkspaceAdminOrOwner bool) error {
	comment, err := s.commentRepo.FindByID(ctx, commentID)
	if err != nil {
		return errors.New("comment not found")
	}

	// Check permission: author of the comment OR workspace admin/owner
	if comment.UserID != userID && !isWorkspaceAdminOrOwner {
		return errors.New("permission denied: only the comment author or workspace admins can delete this comment")
	}

	return s.commentRepo.Delete(ctx, commentID)
}
