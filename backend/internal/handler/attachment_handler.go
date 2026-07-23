package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AttachmentHandler struct {
	attachmentService service.AttachmentService
	taskService       service.TaskService
	projectService    service.ProjectService
	jwtSecret         string
	db                *gorm.DB
}

func NewAttachmentHandler(attachmentService service.AttachmentService, taskService service.TaskService, projectService service.ProjectService, jwtSecret string, db *gorm.DB) *AttachmentHandler {
	return &AttachmentHandler{
		attachmentService: attachmentService,
		taskService:       taskService,
		projectService:    projectService,
		jwtSecret:         jwtSecret,
		db:                db,
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

func (h *AttachmentHandler) getWorkspaceRole(c *gin.Context, workspaceID string) string {
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

func (h *AttachmentHandler) checkTaskMember(c *gin.Context, taskID string) bool {
	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return false
	}

	userID := c.GetString(middleware.UserIDContextKey)
	role := h.getWorkspaceRole(c, task.WorkspaceID)
	if role != "owner" && role != "admin" {
		if task.AssigneeID == nil || *task.AssigneeID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: bạn chưa được gán công việc này"})
			return false
		}
	}

	return true
}

func (h *AttachmentHandler) UploadAttachment(c *gin.Context) {
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied: chỉ người được gán công việc hoặc Admin mới được tải file đính kèm"})
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

	err := h.attachmentService.DeleteAttachment(c.Request.Context(), attachmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "attachment deleted successfully"})
}
