package main

import (
	"log/slog"
	"net/http"
	"os"

	"backend/internal/config"
	"backend/internal/handler"
	"backend/internal/middleware"
	postgresRepo "backend/internal/repository/postgres"
	"backend/internal/service"
	pkgredis "backend/pkg/redis"

	"github.com/gin-gonic/gin"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Initialize default slog logger to write structured JSON to stdout
	jsonHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(jsonHandler)
	slog.SetDefault(logger)

	// Load configuration (looks for .env in current working directory)
	cfg, err := config.LoadConfig(".")
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Set Gin mode according to configuration
	gin.SetMode(cfg.GinMode)

	// 1. Establish PostgreSQL database connection via GORM
	slog.Info("Connecting to PostgreSQL database...")
	db, err := gorm.Open(gormpostgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		slog.Error("Failed to connect to PostgreSQL database", "error", err)
		os.Exit(1)
	}
	slog.Info("Successfully connected to PostgreSQL database")

	// 2. Establish Redis database connection (graceful fallback to local memory on failure)
	var redisClient *pkgredis.Client
	if cfg.RedisURL != "" {
		slog.Info("Connecting to Redis server...")
		client, err := pkgredis.NewRedisClient(cfg.RedisURL)
		if err != nil {
			slog.Warn("Redis connection failed. Falling back to in-memory session tracking.", "error", err)
		} else {
			redisClient = client
			slog.Info("Successfully connected to Redis server")
		}
	} else {
		slog.Warn("REDIS_URL not configured. Using in-memory session tracking.")
	}

	// 3. Initialize layers (Clean/Layered Architecture wiring)
	userRepo := postgresRepo.NewUserRepository(db)
	authService := service.NewAuthService(cfg, userRepo, redisClient)
	authHandler := handler.NewAuthHandler(authService, cfg)

	invitationRepo := postgresRepo.NewInvitationRepository(db)
	emailService := service.NewEmailService(cfg.ResendAPIKey)
	invitationService := service.NewInvitationService(db, invitationRepo, emailService)
	invitationHandler := handler.NewInvitationHandler(invitationService, cfg.JWTSecret)

	hub := service.NewHub()

	workspaceRepo := postgresRepo.NewWorkspaceRepository(db)
	workspaceService := service.NewWorkspaceService(db, workspaceRepo)
	workspaceHandler := handler.NewWorkspaceHandler(workspaceService, cfg.JWTSecret)

	projectRepo := postgresRepo.NewProjectRepository(db)
	projectService := service.NewProjectService(db, projectRepo)
	projectHandler := handler.NewProjectHandler(projectService, cfg.JWTSecret)

	taskRepo := postgresRepo.NewTaskRepository(db)
	taskService := service.NewTaskService(taskRepo)
	taskHandler := handler.NewTaskHandler(taskService, projectService, cfg.JWTSecret, db, hub)

	commentRepo := postgresRepo.NewCommentRepository(db)
	commentService := service.NewCommentService(commentRepo)
	commentHandler := handler.NewCommentHandler(commentService, taskService, projectService, cfg.JWTSecret, db, hub)

	tagRepo := postgresRepo.NewTagRepository(db)
	tagService := service.NewTagService(tagRepo)
	tagHandler := handler.NewTagHandler(tagService, taskService, projectService, cfg.JWTSecret, db)

	attachmentRepo := postgresRepo.NewAttachmentRepository(db)
	attachmentService := service.NewAttachmentService(attachmentRepo, "./uploads")
	attachmentHandler := handler.NewAttachmentHandler(attachmentService, taskService, projectService, cfg.JWTSecret, db)

	notificationRepo := postgresRepo.NewNotificationRepository(db)
	notificationService := service.NewNotificationService(notificationRepo, hub)
	notificationHandler := handler.NewNotificationHandler(notificationService, cfg.JWTSecret)
	wsHandler := handler.NewWebSocketHandler(hub, cfg.JWTSecret)

	// 4. Initialize Gin engine
	r := gin.New()

	// Mount global middlewares
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS())

	// Serve static files uploaded by users
	r.Static("/uploads", "./uploads")

	// WebSocket endpoint
	r.GET("/ws", wsHandler.HandleWebSocket)

	// Health check route
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	// Route to intentionally trigger a panic (for testing recovery middleware)
	r.GET("/panic", func(c *gin.Context) {
		panic("testing recovery middleware: unexpected system panic")
	})

	// Register Auth routes: /auth/google, /auth/google/callback, /auth/refresh, /auth/logout
	authHandler.RegisterRoutes(r)

	// Register Invitation routes: /invitations/:token, /workspaces/:id/invitations, /invitations/:token/accept
	invitationHandler.RegisterRoutes(r)

	// Register Workspace routes
	workspaceHandler.RegisterRoutes(r, db)

	// Register Project routes
	projectHandler.RegisterRoutes(r, db)

	// Register Task routes
	taskHandler.RegisterRoutes(r)

	// Register Comment, Tag, Attachment routes
	commentHandler.RegisterRoutes(r)
	tagHandler.RegisterRoutes(r, db)
	attachmentHandler.RegisterRoutes(r)

	// Register Notification routes
	notificationHandler.RegisterRoutes(r)

	// Test private endpoint protected by JWT verification middleware
	r.GET("/protected", middleware.Auth(cfg.JWTSecret), func(c *gin.Context) {
		userID := c.GetString(middleware.UserIDContextKey)
		email := c.GetString(middleware.UserEmailContextKey)
		c.JSON(http.StatusOK, gin.H{
			"message": "Access granted to secure resource",
			"user_id": userID,
			"email":   email,
		})
	})

	slog.Info("Server is starting", "port", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		slog.Error("Failed to start server", "error", err)
		os.Exit(1)
	}
}
