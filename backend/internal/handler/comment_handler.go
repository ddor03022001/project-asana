package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type CommentHandler struct {
	commentService service.CommentService
	taskService    service.TaskService
	projectService service.ProjectService
	jwtSecret      string
}

func NewCommentHandler(commentService service.CommentService, taskService service.TaskService, projectService service.ProjectService, jwtSecret string) *CommentHandler {
	return &CommentHandler{
		commentService: commentService,
		taskService:    taskService,
		projectService: projectService,
		jwtSecret:      jwtSecret,
	}
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

func (h *CommentHandler) checkTaskMember(c *gin.Context, taskID string) (string, bool) {
	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return "", false
	}

	userID := c.GetString(middleware.UserIDContextKey)
	members, err := h.projectService.GetMembers(c.Request.Context(), task.ProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project membership"})
		return "", false
	}

	for _, m := range members {
		if m.UserID == userID {
			return task.WorkspaceID, true
		}
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not a member of this project"})
	return "", false
}

func (h *CommentHandler) CreateComment(c *gin.Context) {
	taskID := c.Param("id")
	userID := c.GetString(middleware.UserIDContextKey)

	if _, ok := h.checkTaskMember(c, taskID); !ok {
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

	err := h.commentService.DeleteComment(c.Request.Context(), commentID, userID, false)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "comment deleted successfully"})
}
