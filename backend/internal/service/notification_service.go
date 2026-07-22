package service

import (
	"context"
	"fmt"

	"backend/internal/domain"
)

type NotificationService interface {
	CreateNotification(ctx context.Context, userID string, notifType string, content string, relatedTaskID *string) (*domain.Notification, error)
	GetUserNotifications(ctx context.Context, userID string, limit int, offset int) ([]domain.Notification, error)
	MarkAsRead(ctx context.Context, id string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	GetUnreadCount(ctx context.Context, userID string) (int64, error)
	TriggerTaskAssigned(ctx context.Context, taskID string, taskTitle string, assigneeID string, assignerName string)
	TriggerCommentAdded(ctx context.Context, taskID string, taskTitle string, commenterName string, targetUserID string)
}

type notificationService struct {
	notificationRepo domain.NotificationRepository
	hub              *Hub
}

func NewNotificationService(notificationRepo domain.NotificationRepository, hub *Hub) NotificationService {
	return &notificationService{
		notificationRepo: notificationRepo,
		hub:              hub,
	}
}

func (s *notificationService) CreateNotification(ctx context.Context, userID string, notifType string, content string, relatedTaskID *string) (*domain.Notification, error) {
	notification := &domain.Notification{
		UserID:        userID,
		Type:          notifType,
		Content:       content,
		RelatedTaskID: relatedTaskID,
		IsRead:        false,
	}

	if err := s.notificationRepo.Create(ctx, notification); err != nil {
		return nil, err
	}

	// Broadcast real-time event to user's connected WebSockets
	if s.hub != nil {
		s.hub.BroadcastToUser(userID, map[string]interface{}{
			"event":        "notification",
			"notification": notification,
		})
	}

	return notification, nil
}

func (s *notificationService) GetUserNotifications(ctx context.Context, userID string, limit int, offset int) ([]domain.Notification, error) {
	return s.notificationRepo.FindAllByUserID(ctx, userID, limit, offset)
}

func (s *notificationService) MarkAsRead(ctx context.Context, id string, userID string) error {
	return s.notificationRepo.MarkAsRead(ctx, id, userID)
}

func (s *notificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	return s.notificationRepo.MarkAllAsRead(ctx, userID)
}

func (s *notificationService) GetUnreadCount(ctx context.Context, userID string) (int64, error) {
	return s.notificationRepo.GetUnreadCount(ctx, userID)
}

func (s *notificationService) TriggerTaskAssigned(ctx context.Context, taskID string, taskTitle string, assigneeID string, assignerName string) {
	if assigneeID == "" {
		return
	}
	content := fmt.Sprintf("%s đã phân công công việc \"%s\" cho bạn.", assignerName, taskTitle)
	_, _ = s.CreateNotification(ctx, assigneeID, domain.NotificationTypeTaskAssigned, content, &taskID)
}

func (s *notificationService) TriggerCommentAdded(ctx context.Context, taskID string, taskTitle string, commenterName string, targetUserID string) {
	if targetUserID == "" {
		return
	}
	content := fmt.Sprintf("%s đã bình luận vào công việc \"%s\".", commenterName, taskTitle)
	_, _ = s.CreateNotification(ctx, targetUserID, domain.NotificationTypeCommentAdded, content, &taskID)
}
