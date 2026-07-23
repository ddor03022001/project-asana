package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TagHandler struct {
	tagService     service.TagService
	taskService    service.TaskService
	projectService service.ProjectService
	jwtSecret      string
	db             *gorm.DB
}

func NewTagHandler(tagService service.TagService, taskService service.TaskService, projectService service.ProjectService, jwtSecret string, db *gorm.DB) *TagHandler {
	return &TagHandler{
		tagService:     tagService,
		taskService:    taskService,
		projectService: projectService,
		jwtSecret:      jwtSecret,
		db:             db,
	}
}

func (h *TagHandler) RegisterRoutes(r *gin.Engine, db *gorm.DB) {
	// Workspace tag routes
	wsTags := r.Group("/workspaces/:id/tags")
	wsTags.Use(middleware.Auth(h.jwtSecret))
	wsTags.Use(middleware.RequireWorkspaceRole(db, "owner", "admin", "member"))
	{
		wsTags.POST("", h.CreateTag)
		wsTags.GET("", h.GetWorkspaceTags)
	}

	tags := r.Group("/tags/:tagId")
	tags.Use(middleware.Auth(h.jwtSecret))
	{
		tags.DELETE("", h.DeleteTag)
	}

	// Task tag mapping routes
	taskTags := r.Group("/tasks/:id/tags")
	taskTags.Use(middleware.Auth(h.jwtSecret))
	{
		taskTags.GET("", h.GetTaskTags)
		taskTags.POST("/:tagId", h.AttachTagToTask)
		taskTags.DELETE("/:tagId", h.DetachTagFromTask)
	}
}

func (h *TagHandler) getWorkspaceRole(c *gin.Context, workspaceID string) string {
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

func (h *TagHandler) checkTaskMember(c *gin.Context, taskID string) bool {
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

func (h *TagHandler) CreateTag(c *gin.Context) {
	workspaceID := c.Param("id")

	var req service.CreateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := h.tagService.CreateTag(c.Request.Context(), workspaceID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tag)
}

func (h *TagHandler) GetWorkspaceTags(c *gin.Context) {
	workspaceID := c.Param("id")

	tags, err := h.tagService.GetTagsByWorkspace(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tags)
}

func (h *TagHandler) DeleteTag(c *gin.Context) {
	tagID := c.Param("tagId")

	if err := h.tagService.DeleteTag(c.Request.Context(), tagID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tag deleted successfully"})
}

func (h *TagHandler) AttachTagToTask(c *gin.Context) {
	taskID := c.Param("id")
	tagID := c.Param("tagId")
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied: chỉ người được gán công việc hoặc Admin mới được gắn nhãn thẻ"})
		return
	}

	if err := h.tagService.AttachTagToTask(c.Request.Context(), taskID, tagID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tag attached to task successfully"})
}

func (h *TagHandler) DetachTagFromTask(c *gin.Context) {
	taskID := c.Param("id")
	tagID := c.Param("tagId")
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied: chỉ người được gán công việc hoặc Admin mới được gỡ nhãn thẻ"})
		return
	}

	if err := h.tagService.DetachTagFromTask(c.Request.Context(), taskID, tagID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tag detached from task successfully"})
}

func (h *TagHandler) GetTaskTags(c *gin.Context) {
	taskID := c.Param("id")

	if !h.checkTaskMember(c, taskID) {
		return
	}

	tags, err := h.tagService.GetTagsByTask(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tags)
}
