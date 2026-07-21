package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RequireWorkspaceRole checks if the authenticated user has one of the allowed roles in the workspace
func RequireWorkspaceRole(db *gorm.DB, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get userID from JWT Auth middleware context
		userID := c.GetString(UserIDContextKey)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		// Try to read workspace ID from URL parameters ('id' or 'workspaceId')
		workspaceID := c.Param("id")
		if workspaceID == "" {
			workspaceID = c.Param("workspaceId")
		}

		if workspaceID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Workspace ID is required"})
			return
		}

		// Query the user's role inside the target workspace
		var member struct {
			Role string
		}
		err := db.Table("workspace_members").
			Select("role").
			Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
			First(&member).Error

		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Permission denied: you are not a member of this workspace"})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify workspace permissions"})
			return
		}

		// Check if user's role is in the list of allowed roles
		isAllowed := false
		for _, role := range allowedRoles {
			if member.Role == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Permission denied: insufficient privileges within this workspace"})
			return
		}

		c.Next()
	}
}
