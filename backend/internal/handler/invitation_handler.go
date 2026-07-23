package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type InvitationHandler struct {
	invService service.InvitationService
	jwtSecret  string
}

// NewInvitationHandler creates a new InvitationHandler instance
func NewInvitationHandler(invService service.InvitationService, jwtSecret string) *InvitationHandler {
	return &InvitationHandler{
		invService: invService,
		jwtSecret:  jwtSecret,
	}
}

// RegisterRoutes registers the invitation endpoints under appropriate route groups
func (h *InvitationHandler) RegisterRoutes(r *gin.Engine) {
	// Public routes
	r.GET("/invitations/:token", h.GetInvitation)

	// Protected routes (require JWT verification)
	protected := r.Group("")
	protected.Use(middleware.Auth(h.jwtSecret))
	{
		protected.POST("/workspaces/:id/invitations", h.CreateInvitation)
		protected.GET("/workspaces/:id/invitations", h.GetPendingInvitations)
		protected.POST("/invitations/:token/accept", h.AcceptInvitation)
		protected.DELETE("/invitations/:id", h.CancelInvitation)
	}
}

// CreateInvitation handles inviting a user to a workspace
func (h *InvitationHandler) CreateInvitation(c *gin.Context) {
	workspaceID := c.Param("id")
	senderID := c.GetString(middleware.UserIDContextKey)

	var req service.CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invitation, err := h.invService.CreateInvitation(c.Request.Context(), senderID, workspaceID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invitation)
}

func (h *InvitationHandler) GetPendingInvitations(c *gin.Context) {
	workspaceID := c.Param("id")
	senderID := c.GetString(middleware.UserIDContextKey)

	invitations, err := h.invService.GetPendingInvitations(c.Request.Context(), senderID, workspaceID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invitations)
}

func (h *InvitationHandler) CancelInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	senderID := c.GetString(middleware.UserIDContextKey)

	if err := h.invService.CancelInvitation(c.Request.Context(), senderID, invitationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invitation cancelled"})
}

// GetInvitation fetches invitation details by token (public endpoint)
func (h *InvitationHandler) GetInvitation(c *gin.Context) {
	token := c.Param("token")

	invitation, err := h.invService.GetInvitation(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return data: workspace name and invitation role (do not expose token or unnecessary details)
	c.JSON(http.StatusOK, gin.H{
		"email":          invitation.Email,
		"workspace_name": invitation.Workspace.Name,
		"role":           invitation.Role,
	})
}

// AcceptInvitation allows the logged-in user to accept the invitation
func (h *InvitationHandler) AcceptInvitation(c *gin.Context) {
	token := c.Param("token")
	userID := c.GetString(middleware.UserIDContextKey)
	userEmail := c.GetString(middleware.UserEmailContextKey)

	err := h.invService.AcceptInvitation(c.Request.Context(), token, userID, userEmail)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "successfully joined workspace"})
}
