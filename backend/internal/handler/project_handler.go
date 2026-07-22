package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProjectHandler struct {
	projectService service.ProjectService
	jwtSecret      string
}

// NewProjectHandler creates a new ProjectHandler instance
func NewProjectHandler(projectService service.ProjectService, jwtSecret string) *ProjectHandler {
	return &ProjectHandler{
		projectService: projectService,
		jwtSecret:      jwtSecret,
	}
}

// RegisterRoutes registers the project endpoints in Gin router
func (h *ProjectHandler) RegisterRoutes(r *gin.Engine, db *gorm.DB) {
	// Workspace project endpoints (guarded by workspace membership)
	wsProjects := r.Group("/workspaces/:id/projects")
	wsProjects.Use(middleware.Auth(h.jwtSecret))
	wsProjects.Use(middleware.RequireWorkspaceRole(db, "owner", "admin", "member"))
	{
		wsProjects.POST("", h.CreateProject)
		wsProjects.GET("", h.GetProjects)
	}

	// Project specific endpoints (guarded by project membership validated inside handlers)
	projects := r.Group("/projects/:id")
	projects.Use(middleware.Auth(h.jwtSecret))
	{
		projects.GET("", h.GetProjectByID)
		projects.PATCH("", h.UpdateProject)
		projects.DELETE("", h.DeleteProject)

		// Member management inside project
		projects.GET("/members", h.GetMembers)
		projects.POST("/members", h.AddMember)
		projects.DELETE("/members/:userId", h.RemoveMember)
	}
}

func (h *ProjectHandler) checkMembership(c *gin.Context, projectID string) bool {
	userID := c.GetString(middleware.UserIDContextKey)
	members, err := h.projectService.GetMembers(c.Request.Context(), projectID)
	if err == nil {
		for _, m := range members {
			if m.UserID == userID {
				return true
			}
		}
	}

	project, err := h.projectService.GetProjectByID(c.Request.Context(), projectID)
	if err == nil && project != nil {
		return true
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not a member of this project"})
	return false
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	workspaceID := c.Param("id")
	userID := c.GetString(middleware.UserIDContextKey)

	var req service.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project, err := h.projectService.CreateProject(c.Request.Context(), workspaceID, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) GetProjects(c *gin.Context) {
	workspaceID := c.Param("id")
	userID := c.GetString(middleware.UserIDContextKey)

	projects, err := h.projectService.GetProjects(c.Request.Context(), workspaceID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) GetProjectByID(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkMembership(c, projectID) {
		return
	}

	project, err := h.projectService.GetProjectByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkMembership(c, projectID) {
		return
	}

	var req service.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project, err := h.projectService.UpdateProject(c.Request.Context(), projectID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkMembership(c, projectID) {
		return
	}

	err := h.projectService.DeleteProject(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "project archived successfully"})
}

func (h *ProjectHandler) GetMembers(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkMembership(c, projectID) {
		return
	}

	members, err := h.projectService.GetMembers(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h *ProjectHandler) AddMember(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkMembership(c, projectID) {
		return
	}

	var req service.AddProjectMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.projectService.AddMember(c.Request.Context(), projectID, req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member added to project successfully"})
}

func (h *ProjectHandler) RemoveMember(c *gin.Context) {
	projectID := c.Param("id")
	targetUserID := c.Param("userId")

	if !h.checkMembership(c, projectID) {
		return
	}

	err := h.projectService.RemoveMember(c.Request.Context(), projectID, targetUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed from project successfully"})
}
