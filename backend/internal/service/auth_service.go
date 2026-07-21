package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"backend/internal/config"
	"backend/internal/domain"
	pkgjwt "backend/pkg/jwt"
	pkgredis "backend/pkg/redis"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// AuthService outlines the required business logic for authentication
type AuthService interface {
	GetGoogleAuthURL(state string) string
	VerifyGoogleCallback(ctx context.Context, code string) (*domain.User, error)
	GenerateTokenPair(userID string, email string) (string, string, error)
	RefreshTokens(ctx context.Context, refreshToken string) (string, string, error)
	Logout(ctx context.Context, refreshToken string) error
	MockLogin(ctx context.Context, id, email, name string) (*domain.User, error)
}

type authService struct {
	cfg         *config.Config
	userRepo    domain.UserRepository
	redisClient *pkgredis.Client
	oauthConfig *oauth2.Config
	
	// Thread-safe in-memory fallback when Redis is offline/not configured
	inMemoryRT  map[string]string
	mu          sync.RWMutex
}

// NewAuthService creates and initializes a new AuthService
func NewAuthService(cfg *config.Config, userRepo domain.UserRepository, redisClient *pkgredis.Client) AuthService {
	// Construct local redirect URL (Google redirects user here after authentication)
	redirectURL := fmt.Sprintf("http://localhost:%s/auth/google/callback", cfg.Port)

	oauthConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  redirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.profile",
			"https://www.googleapis.com/auth/userinfo.email",
		},
		Endpoint: google.Endpoint,
	}

	return &authService{
		cfg:         cfg,
		userRepo:    userRepo,
		redisClient: redisClient,
		oauthConfig: oauthConfig,
		inMemoryRT:  make(map[string]string),
	}
}

func (s *authService) GetGoogleAuthURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// GoogleUser matches the userinfo payload returned by Google API
type GoogleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (s *authService) VerifyGoogleCallback(ctx context.Context, code string) (*domain.User, error) {
	// 1. Exchange authorization code for OAuth 2.0 token
	token, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange oauth code: %w", err)
	}

	// 2. Request user profile details from Google APIs using token
	client := s.oauthConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch userinfo from google: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google api returned bad status code: %d", resp.StatusCode)
	}

	var googleUser GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		return nil, fmt.Errorf("failed to decode google profile: %w", err)
	}

	if googleUser.Email == "" {
		return nil, errors.New("email is missing in Google profile payload")
	}

	// 3. User mapping (Find-or-create logic)
	user, err := s.userRepo.FindByEmail(ctx, googleUser.Email)
	if err != nil {
		// User does not exist, insert new record
		user = &domain.User{
			Email:     googleUser.Email,
			Name:      googleUser.Name,
			AvatarURL: googleUser.Picture,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("failed to create user in database: %w", err)
		}
		slog.Info("created new user from Google login", "email", user.Email, "id", user.ID)
	} else {
		// User exists, update name/avatar if they changed
		updated := false
		if user.Name != googleUser.Name {
			user.Name = googleUser.Name
			updated = true
		}
		if user.AvatarURL != googleUser.Picture {
			user.AvatarURL = googleUser.Picture
			updated = true
		}
		if updated {
			if err := s.userRepo.Update(ctx, user); err != nil {
				return nil, fmt.Errorf("failed to update user details: %w", err)
			}
			slog.Debug("updated existing user profile details", "email", user.Email)
		}
	}

	return user, nil
}

func (s *authService) GenerateTokenPair(userID string, email string) (string, string, error) {
	// Access token (expires in 15 minutes)
	accessToken, err := pkgjwt.GenerateToken(userID, email, s.cfg.JWTSecret, 15*time.Minute)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate access token: %w", err)
	}

	// Refresh token (expires in 30 days)
	refreshToken, err := pkgjwt.GenerateToken(userID, email, s.cfg.JWTSecret, 30*24*time.Hour)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token to verify sessions and support logout/revocation
	rtKey := fmt.Sprintf("rt:%s", userID)
	if s.redisClient != nil {
		// Store in Redis (production / docker mode)
		ctx := context.Background()
		if err := s.redisClient.Set(ctx, rtKey, refreshToken, 30*24*time.Hour); err != nil {
			slog.Warn("redis write failed, writing session to memory fallback", "error", err)
			s.writeToMemory(rtKey, refreshToken)
		}
	} else {
		// Store in-memory (local development fallback without Docker)
		s.writeToMemory(rtKey, refreshToken)
	}

	return accessToken, refreshToken, nil
}

func (s *authService) RefreshTokens(ctx context.Context, refreshToken string) (string, string, error) {
	// 1. Verify token signature & expiration
	claims, err := pkgjwt.ValidateToken(refreshToken, s.cfg.JWTSecret)
	if err != nil {
		return "", "", fmt.Errorf("invalid refresh token: %w", err)
	}

	// 2. Fetch the active refresh token associated with this user ID
	rtKey := fmt.Sprintf("rt:%s", claims.UserID)
	var storedToken string
	var retrieveErr error

	if s.redisClient != nil {
		storedToken, retrieveErr = s.redisClient.Get(ctx, rtKey)
		if retrieveErr != nil {
			// Check if fallback has it
			storedToken = s.readFromMemory(rtKey)
		}
	} else {
		storedToken = s.readFromMemory(rtKey)
	}

	if storedToken == "" {
		return "", "", errors.New("session expired or refresh token revoked")
	}

	// 3. Confirm that the incoming token matches the latest issued token
	if storedToken != refreshToken {
		return "", "", errors.New("refresh token does not match active session")
	}

	// 4. Issue a rotated token pair (Refresh Token Rotation)
	newAccessToken, newRefreshToken, err := s.GenerateTokenPair(claims.UserID, claims.Email)
	if err != nil {
		return "", "", fmt.Errorf("failed to rotate tokens: %w", err)
	}

	return newAccessToken, newRefreshToken, nil
}

func (s *authService) Logout(ctx context.Context, refreshToken string) error {
	claims, err := pkgjwt.ValidateToken(refreshToken, s.cfg.JWTSecret)
	if err != nil {
		return fmt.Errorf("cannot parse logout token: %w", err)
	}

	rtKey := fmt.Sprintf("rt:%s", claims.UserID)
	
	// Delete active session refresh token
	if s.redisClient != nil {
		_ = s.redisClient.Del(ctx, rtKey)
	}
	s.deleteFromMemory(rtKey)

	slog.Info("user logged out successfully", "user_id", claims.UserID)
	return nil
}

// Thread-safe write to memory fallback map
func (s *authService) writeToMemory(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.inMemoryRT[key] = value
}

// Thread-safe read from memory fallback map
func (s *authService) readFromMemory(key string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.inMemoryRT[key]
}

// Thread-safe delete from memory fallback map
func (s *authService) deleteFromMemory(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.inMemoryRT, key)
}

// MockLogin implements bypass logic for local development testing
func (s *authService) MockLogin(ctx context.Context, id, email, name string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		// User does not exist, create the mock user
		user = &domain.User{
			ID:        id,
			Email:     email,
			Name:      name,
			AvatarURL: "https://lh3.googleusercontent.com/a/default-user=s96-c",
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("failed to create mock user: %w", err)
		}
		slog.Info("created mock user for development testing", "email", email, "id", id)
	}
	return user, nil
}

