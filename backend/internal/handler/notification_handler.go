package handler

import (
	"net/http"
	"strconv"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	notificationService service.NotificationService
	jwtSecret           string
}

func NewNotificationHandler(notificationService service.NotificationService, jwtSecret string) *NotificationHandler {
	return &NotificationHandler{
		notificationService: notificationService,
		jwtSecret:           jwtSecret,
	}
}

func (h *NotificationHandler) RegisterRoutes(r *gin.Engine) {
	notifications := r.Group("/notifications")
	notifications.Use(middleware.Auth(h.jwtSecret))
	{
		notifications.GET("", h.GetUserNotifications)
		notifications.GET("/unread-count", h.GetUnreadCount)
		notifications.PATCH("/:id/read", h.MarkAsRead)
		notifications.PATCH("/read-all", h.MarkAllAsRead)
	}
}

func (h *NotificationHandler) GetUserNotifications(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	notifications, err := h.notificationService.GetUserNotifications(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)

	count, err := h.notificationService.GetUnreadCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)
	id := c.Param("id")

	if err := h.notificationService.MarkAsRead(c.Request.Context(), id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)

	if err := h.notificationService.MarkAllAsRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}
