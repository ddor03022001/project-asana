package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type SearchHandler struct {
	searchService service.SearchService
	jwtSecret     string
}

func NewSearchHandler(searchService service.SearchService, jwtSecret string) *SearchHandler {
	return &SearchHandler{
		searchService: searchService,
		jwtSecret:     jwtSecret,
	}
}

func (h *SearchHandler) RegisterRoutes(r *gin.Engine) {
	searchGroup := r.Group("/search")
	searchGroup.Use(middleware.Auth(h.jwtSecret))
	{
		searchGroup.GET("", h.GlobalSearch)
	}
}

func (h *SearchHandler) GlobalSearch(c *gin.Context) {
	userID := c.GetString(middleware.UserIDContextKey)
	workspaceID := c.Query("workspace_id")
	query := c.Query("q")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id parameter is required"})
		return
	}

	result, err := h.searchService.Search(c.Request.Context(), workspaceID, userID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
