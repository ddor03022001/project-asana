package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
)

// Recovery handles panics inside requests, logs them, and returns a JSON response
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				requestID := c.GetString(RequestIDKey)

				// Log the panic with stack trace
				slog.Error("panic recovered",
					slog.String("request_id", requestID),
					slog.Any("error", err),
					slog.String("stack", string(debug.Stack())),
				)

				// Return custom JSON error
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error":      "Internal Server Error",
					"request_id": requestID,
				})
			}
		}()
		c.Next()
	}
}
