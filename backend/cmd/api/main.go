package main

import (
	"log/slog"
	"net/http"
	"os"

	"backend/internal/config"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize default slog logger to write structured JSON to stdout
	jsonHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	logger := slog.New(jsonHandler)
	slog.SetDefault(logger)

	// Load configuration (looks for .env in the current working directory)
	cfg, err := config.LoadConfig(".")
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Set Gin mode according to configuration
	gin.SetMode(cfg.GinMode)

	// Create gin engine
	r := gin.New()

	// Mount custom middlewares
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS())

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

	slog.Info("Server is starting", "port", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		slog.Error("Failed to start server", "error", err)
		os.Exit(1)
	}
}
