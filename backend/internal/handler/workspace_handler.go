package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type WorkspaceHandler struct {
	workspaceService service.WorkspaceService
	jwtSecret        string
}

// NewWorkspaceHandler creates a new WorkspaceHandler instance
func NewWorkspaceHandler(workspaceService service.WorkspaceService, jwtSecret string) *WorkspaceHandler {
	return &WorkspaceHandler{
		workspaceService: workspaceService,
		jwtSecret:        jwtSecret,
	}
}

// RegisterRoutes registers the workspace endpoints with authentication and RBAC middlewares
func (h *WorkspaceHandler) RegisterRoutes(r *gin.Engine, db *gorm.DB) {
	ws := r.Group("/workspaces")
	// All workspace APIs require a valid JWT session
	ws.Use(middleware.Auth(h.jwtSecret))
	{
		ws.POST("", h.CreateWorkspace)
		ws.GET("", h.GetWorkspaces)

		// Resource specific endpoints guarded by role requirements
		ws.GET("/:id", middleware.RequireWorkspaceRole(db, "owner", "admin", "member"), h.GetWorkspaceByID)
		ws.PATCH("/:id", middleware.RequireWorkspaceRole(db, "owner", "admin"), h.UpdateWorkspace)
		ws.DELETE("/:id", middleware.RequireWorkspaceRole(db, "owner"), h.DeleteWorkspace)

		// Member management endpoints
		ws.GET("/:id/members", middleware.RequireWorkspaceRole(db, "owner", "admin", "member"), h.GetMembers)
		ws.PATCH("/:id/members/:userId", middleware.RequireWorkspaceRole(db, "owner", "admin"), h.UpdateMemberRole)
		ws.DELETE("/:id/members/:userId", middleware.RequireWorkspaceRole(db, "owner", "admin"), h.RemoveMember)
	}
}

func (h *WorkspaceHandler) CreateWorkspace(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)

	var req service.CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ws, err := h.workspaceService.CreateWorkspace(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ws)
}

func (h *WorkspaceHandler) GetWorkspaces(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)

	workspaces, err := h.workspaceService.GetWorkspaces(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspaces)
}

func (h *WorkspaceHandler) GetWorkspaceByID(c *gin.Context) {
	workspaceID := c.Param("id")

	ws, err := h.workspaceService.GetWorkspaceByID(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ws)
}

func (h *WorkspaceHandler) UpdateWorkspace(c *gin.Context) {
	workspaceID := c.Param("id")

	var req service.UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ws, err := h.workspaceService.UpdateWorkspace(c.Request.Context(), workspaceID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ws)
}

func (h *WorkspaceHandler) DeleteWorkspace(c *gin.Context) {
	workspaceID := c.Param("id")

	err := h.workspaceService.DeleteWorkspace(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "workspace deleted successfully"})
}

func (h *WorkspaceHandler) GetMembers(c *gin.Context) {
	workspaceID := c.Param("id")

	members, err := h.workspaceService.GetMembers(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h *WorkspaceHandler) UpdateMemberRole(c *gin.Context) {
	workspaceID := c.Param("id")
	targetUserID := c.Param("userId")

	var req service.UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.workspaceService.UpdateMemberRole(c.Request.Context(), workspaceID, targetUserID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member role updated successfully"})
}

func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	workspaceID := c.Param("id")
	targetUserID := c.Param("userId")

	err := h.workspaceService.RemoveMember(c.Request.Context(), workspaceID, targetUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed from workspace successfully"})
}
