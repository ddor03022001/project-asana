package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDKey is the key used to store the request ID in the gin context
const RequestIDKey = "request_id"

// Logger returns a middleware that logs HTTP requests as structured JSON using log/slog
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate or read request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Header("X-Request-ID", requestID)
		c.Set(RequestIDKey, requestID)

		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		end := time.Now()
		latency := end.Sub(start)

		status := c.Writer.Status()
		method := c.Request.Method
		clientIP := c.ClientIP()

		// Log using standard slog structured logger
		slog.Info("http request",
			slog.String("request_id", requestID),
			slog.String("method", method),
			slog.String("path", path),
			slog.String("query", query),
			slog.Int("status", status),
			slog.String("ip", clientIP),
			slog.Duration("latency", latency),
			slog.String("user_agent", c.Request.UserAgent()),
		)
	}
}
