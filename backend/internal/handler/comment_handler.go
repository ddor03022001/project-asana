package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommentHandler struct {
	commentService      service.CommentService
	taskService         service.TaskService
	projectService      service.ProjectService
	notificationService service.NotificationService
	jwtSecret           string
	db                  *gorm.DB
	hub                 *service.Hub
}

func NewCommentHandler(commentService service.CommentService, taskService service.TaskService, projectService service.ProjectService, notificationService service.NotificationService, jwtSecret string, db *gorm.DB, hub *service.Hub) *CommentHandler {
	return &CommentHandler{
		commentService:      commentService,
		taskService:         taskService,
		projectService:      projectService,
		notificationService: notificationService,
		jwtSecret:           jwtSecret,
		db:                  db,
		hub:                 hub,
	}
}

func (h *CommentHandler) getUserName(userID string) string {
	var user struct {
		Name  string
		Email string
	}
	err := h.db.Table("users").Select("name, email").Where("id = ?", userID).First(&user).Error
	if err == nil {
		if user.Name != "" {
			return user.Name
		}
		return user.Email
	}
	return "Thành viên"
}

func (h *CommentHandler) RegisterRoutes(r *gin.Engine) {
	tasks := r.Group("/tasks/:id/comments")
	tasks.Use(middleware.Auth(h.jwtSecret))
	{
		tasks.POST("", h.CreateComment)
		tasks.GET("", h.GetComments)
	}

	comments := r.Group("/comments/:commentId")
	comments.Use(middleware.Auth(h.jwtSecret))
	{
		comments.DELETE("", h.DeleteComment)
	}
}

func (h *CommentHandler) getWorkspaceRole(c *gin.Context, workspaceID string) string {
	userID := c.GetString(middleware.UserIDContextKey)
	var member struct {
		Role string
	}
	err := h.db.Table("workspace_members").
		Select("role").
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		First(&member).Error
	if err != nil {
		return ""
	}
	return member.Role
}

func (h *CommentHandler) checkTaskMember(c *gin.Context, taskID string) (string, bool) {
	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return "", false
	}

	userID := c.GetString(middleware.UserIDContextKey)
	role := h.getWorkspaceRole(c, task.WorkspaceID)
	if role != "owner" && role != "admin" {
		if task.AssigneeID == nil || *task.AssigneeID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: bạn chưa được gán công việc này"})
			return "", false
		}
	}

	return task.WorkspaceID, true
}

func (h *CommentHandler) CreateComment(c *gin.Context) {
	taskID := c.Param("id")
	userID := c.GetString(middleware.UserIDContextKey)

	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	role := h.getWorkspaceRole(c, task.WorkspaceID)
	isOwnerOrAdmin := role == "owner" || role == "admin"
	isAssignee := task.AssigneeID != nil && *task.AssigneeID == userID

	if !isOwnerOrAdmin && !isAssignee {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied: chỉ người được gán công việc hoặc Admin mới được bình luận"})
		return
	}

	var req service.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comment, err := h.commentService.CreateComment(c.Request.Context(), taskID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	commenterName := h.getUserName(userID)
	h.notificationService.TriggerCommentAdded(c.Request.Context(), task.ID, task.Title, commenterName, userID, task.WorkspaceID, task.AssigneeID, h.db)

	if h.hub != nil {
		h.hub.BroadcastToAll(gin.H{
			"type":    "COMMENT_CREATED",
			"task_id": taskID,
		})
	}

	c.JSON(http.StatusCreated, comment)
}

func (h *CommentHandler) GetComments(c *gin.Context) {
	taskID := c.Param("id")

	if _, ok := h.checkTaskMember(c, taskID); !ok {
		return
	}

	comments, err := h.commentService.GetComments(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, comments)
}

func (h *CommentHandler) DeleteComment(c *gin.Context) {
	commentID := c.Param("commentId")
	userID := c.GetString(middleware.UserIDContextKey)

	var cm struct {
		TaskID string
		UserID string
	}
	if err := h.db.Table("comments").Select("task_id, user_id").Where("id = ?", commentID).First(&cm).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "comment not found"})
		return
	}

	task, err := h.taskService.GetTaskByID(c.Request.Context(), cm.TaskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	role := h.getWorkspaceRole(c, task.WorkspaceID)
	isOwnerOrAdmin := role == "owner" || role == "admin"

	err = h.commentService.DeleteComment(c.Request.Context(), commentID, userID, isOwnerOrAdmin)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastToAll(gin.H{
			"type":    "COMMENT_CREATED",
			"task_id": cm.TaskID,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "comment deleted successfully"})
}
