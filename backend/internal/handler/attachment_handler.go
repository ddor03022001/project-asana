package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type AttachmentHandler struct {
	attachmentService service.AttachmentService
	taskService       service.TaskService
	projectService    service.ProjectService
	jwtSecret         string
}

func NewAttachmentHandler(attachmentService service.AttachmentService, taskService service.TaskService, projectService service.ProjectService, jwtSecret string) *AttachmentHandler {
	return &AttachmentHandler{
		attachmentService: attachmentService,
		taskService:       taskService,
		projectService:    projectService,
		jwtSecret:         jwtSecret,
	}
}

func (h *AttachmentHandler) RegisterRoutes(r *gin.Engine) {
	tasks := r.Group("/tasks/:id/attachments")
	tasks.Use(middleware.Auth(h.jwtSecret))
	{
		tasks.POST("", h.UploadAttachment)
		tasks.GET("", h.GetAttachments)
	}

	attachments := r.Group("/attachments/:attachmentId")
	attachments.Use(middleware.Auth(h.jwtSecret))
	{
		attachments.DELETE("", h.DeleteAttachment)
	}
}

func (h *AttachmentHandler) checkTaskMember(c *gin.Context, taskID string) bool {
	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return false
	}

	userID := c.GetString(middleware.UserIDContextKey)
	members, err := h.projectService.GetMembers(c.Request.Context(), task.ProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project membership"})
		return false
	}

	for _, m := range members {
		if m.UserID == userID {
			return true
		}
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not a member of this project"})
	return false
}

func (h *AttachmentHandler) UploadAttachment(c *gin.Context) {
	taskID := c.Param("id")
	userID := c.GetString(middleware.UserIDContextKey)

	if !h.checkTaskMember(c, taskID) {
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded or invalid form key 'file'"})
		return
	}

	attachment, err := h.attachmentService.SaveAttachment(c.Request.Context(), taskID, userID, fileHeader)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, attachment)
}

func (h *AttachmentHandler) GetAttachments(c *gin.Context) {
	taskID := c.Param("id")

	if !h.checkTaskMember(c, taskID) {
		return
	}

	attachments, err := h.attachmentService.GetAttachmentsByTask(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attachments)
}

func (h *AttachmentHandler) DeleteAttachment(c *gin.Context) {
	attachmentID := c.Param("attachmentId")

	if err := h.attachmentService.DeleteAttachment(c.Request.Context(), attachmentID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "attachment deleted successfully"})
}
