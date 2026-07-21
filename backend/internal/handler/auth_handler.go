package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"

	"backend/internal/config"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService service.AuthService
	cfg         *config.Config
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(authService service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		cfg:         cfg,
	}
}

// RegisterRoutes registers the authentication endpoints in Gin router
func (h *AuthHandler) RegisterRoutes(r *gin.Engine) {
	auth := r.Group("/auth")
	{
		auth.GET("/google", h.LoginGoogle)
		auth.GET("/google/callback", h.GoogleCallback)
		auth.POST("/refresh", h.Refresh)
		auth.POST("/logout", h.Logout)
		
		// Development-only bypass endpoint for offline testing
		if h.cfg.GinMode == "debug" {
			auth.GET("/mock", h.MockLogin)
		}
	}
}

// LoginGoogle redirects user to Google Consent page
func (h *AuthHandler) LoginGoogle(c *gin.Context) {
	// Generate random secure state token for CSRF protection
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)

	// Store state token in secure cookie (HTTP-only, 5-minute expiry)
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)

	// Fetch redirect URL and redirect browser
	authURL := h.authService.GetGoogleAuthURL(state)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GoogleCallback processes callback from Google, authenticates user, and redirects to frontend
func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	// 1. Verify CSRF state token
	stateParam := c.Query("state")
	stateCookie, err := c.Cookie("oauth_state")
	if err != nil || stateCookie != stateParam {
		c.JSON(http.StatusBadRequest, gin.H{"error": "state token mismatch (CSRF warning)"})
		return
	}

	// Clear the state cookie
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	// 2. Read authorization code
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code is missing"})
		return
	}

	// 3. Exchange code for user details
	user, err := h.authService.VerifyGoogleCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to verify login: %v", err)})
		return
	}

	// 4. Issue JWT access and refresh token pair
	accessToken, refreshToken, err := h.authService.GenerateTokenPair(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue authentication tokens"})
		return
	}

	// 5. Redirect browser back to the frontend Next.js callback handler URL
	// We read frontend host/port from environment if set, otherwise default to http://localhost:3000
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	
	redirectPath := fmt.Sprintf("%s/login/callback?access_token=%s&refresh_token=%s", frontendURL, accessToken, refreshToken)
	c.Redirect(http.StatusTemporaryRedirect, redirectPath)
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// Refresh handles rotating access and refresh tokens
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newAccessToken, newRefreshToken, err := h.authService.RefreshTokens(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  newAccessToken,
		"refresh_token": newRefreshToken,
	})
}

// Logout revokes the refresh token and ends the active session
func (h *AuthHandler) Logout(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// MockLogin bypasses Google OAuth in dev environment to return token pair for testing
func (h *AuthHandler) MockLogin(c *gin.Context) {
	email := c.DefaultQuery("email", "mockuser@example.com")
	name := c.DefaultQuery("name", "Mock User")
	id := c.DefaultQuery("id", "00000000-0000-0000-0000-000000000001") // Mock UUID

	user, err := h.authService.MockLogin(c.Request.Context(), id, email, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to setup mock user: %v", err)})
		return
	}

	// Issue token pair directly
	accessToken, refreshToken, err := h.authService.GenerateTokenPair(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue tokens"})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	
	redirectPath := fmt.Sprintf("%s/login/callback?access_token=%s&refresh_token=%s", frontendURL, accessToken, refreshToken)
	c.Redirect(http.StatusTemporaryRedirect, redirectPath)
}
