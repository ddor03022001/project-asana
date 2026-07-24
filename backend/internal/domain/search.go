package domain

import "context"

type SearchResultProject struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type SearchResultTask struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	ProjectID   string `json:"project_id"`
	ProjectName string `json:"project_name"`
}

type SearchResponse struct {
	Projects []SearchResultProject `json:"projects"`
	Tasks    []SearchResultTask    `json:"tasks"`
}

type SearchRepository interface {
	SearchProjects(ctx context.Context, workspaceID string, userID string, isOwnerOrAdmin bool, query string) ([]SearchResultProject, error)
	SearchTasks(ctx context.Context, workspaceID string, userID string, isOwnerOrAdmin bool, query string) ([]SearchResultTask, error)
}
