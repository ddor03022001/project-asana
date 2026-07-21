package middleware

import (
	"net/http"
	"strings"

	pkgjwt "backend/pkg/jwt"

	"github.com/gin-gonic/gin"
)

// Context keys used to retrieve authenticated user information
const (
	UserIDContextKey    = "userID"
	UserEmailContextKey = "userEmail"
)

// Auth returns a Gin middleware that validates JWT access tokens
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		// Verify Authorization header scheme is "Bearer"
		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be in 'Bearer <token>' format"})
			return
		}

		tokenStr := parts[1]
		claims, err := pkgjwt.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid, malformed, or expired access token"})
			return
		}

		// Store user credentials inside Gin request context for downstream handlers to read
		c.Set(UserIDContextKey, claims.UserID)
		c.Set(UserEmailContextKey, claims.Email)

		c.Next()
	}
}
