package handler

import (
	"net/http"

	"backend/internal/middleware"
	"backend/internal/service"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	taskService    service.TaskService
	projectService service.ProjectService
	jwtSecret      string
}

// NewTaskHandler creates a new TaskHandler instance
func NewTaskHandler(taskService service.TaskService, projectService service.ProjectService, jwtSecret string) *TaskHandler {
	return &TaskHandler{
		taskService:    taskService,
		projectService: projectService,
		jwtSecret:      jwtSecret,
	}
}

// RegisterRoutes registers the task and subtask routes in Gin
func (h *TaskHandler) RegisterRoutes(r *gin.Engine) {
	// Task operations tied to projects
	pTasks := r.Group("/projects/:id/tasks")
	pTasks.Use(middleware.Auth(h.jwtSecret))
	{
		pTasks.POST("", h.CreateTask)
		pTasks.GET("", h.GetTasks)
	}

	// Task specific operations
	tasks := r.Group("/tasks/:id")
	tasks.Use(middleware.Auth(h.jwtSecret))
	{
		tasks.GET("", h.GetTaskByID)
		tasks.PATCH("", h.UpdateTask)
		tasks.DELETE("", h.DeleteTask)
		
		tasks.PATCH("/status", h.UpdateTaskStatus)
		tasks.PATCH("/position", h.UpdateTaskPosition)

		// Subtasks inside task
		tasks.POST("/subtasks", h.CreateSubtask)
		tasks.GET("/subtasks", h.GetSubtasks)
	}

	// Subtask specific operations
	subtasks := r.Group("/subtasks/:subtaskId")
	subtasks.Use(middleware.Auth(h.jwtSecret))
	{
		subtasks.PATCH("", h.UpdateSubtask)
		subtasks.DELETE("", h.DeleteSubtask)
	}
}

func (h *TaskHandler) checkProjectMember(c *gin.Context, projectID string) bool {
	userID := c.GetString(middleware.UserIDContextKey)
	members, err := h.projectService.GetMembers(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project membership"})
		return false
	}

	for _, m := range members {
		if m.UserID == userID {
			return true
		}
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: you are not a member of this project"})
	return false
}

func (h *TaskHandler) checkTaskMember(c *gin.Context, taskID string) (string, bool) {
	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return "", false
	}

	if !h.checkProjectMember(c, task.ProjectID) {
		return "", false
	}

	return task.WorkspaceID, true
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkProjectMember(c, projectID) {
		return
	}

	var req service.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch workspace ID from project to link the task correctly
	project, err := h.projectService.GetProjectByID(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	task, err := h.taskService.CreateTask(c.Request.Context(), project.WorkspaceID, projectID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *TaskHandler) GetTasks(c *gin.Context) {
	projectID := c.Param("id")

	if !h.checkProjectMember(c, projectID) {
		return
	}

	// Parse optional filter query params
	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	if assigneeID := c.Query("assignee_id"); assigneeID != "" {
		filters["assignee_id"] = assigneeID
	}
	if priority := c.Query("priority"); priority != "" {
		filters["priority"] = priority
	}
	if from := c.Query("from"); from != "" {
		filters["from"] = from
	}
	if to := c.Query("to"); to != "" {
		filters["to"] = to
	}

	tasks, err := h.taskService.GetTasks(c.Request.Context(), projectID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func (h *TaskHandler) GetTaskByID(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	task, err := h.taskService.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	var req service.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.UpdateTask(c.Request.Context(), taskID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) DeleteTask(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	err := h.taskService.DeleteTask(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task archived successfully"})
}

func (h *TaskHandler) UpdateTaskStatus(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	var req service.UpdateTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.UpdateTaskStatus(c.Request.Context(), taskID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateTaskPosition(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	var req service.UpdateTaskPositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.UpdateTaskPosition(c.Request.Context(), taskID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

// Subtasks Handler endpoints

func (h *TaskHandler) CreateSubtask(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	var req service.CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	subtask, err := h.taskService.CreateSubtask(c.Request.Context(), taskID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, subtask)
}

func (h *TaskHandler) GetSubtasks(c *gin.Context) {
	taskID := c.Param("id")

	_, ok := h.checkTaskMember(c, taskID)
	if !ok {
		return
	}

	subtasks, err := h.taskService.GetSubtasks(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, subtasks)
}

func (h *TaskHandler) UpdateSubtask(c *gin.Context) {
	subtaskId := c.Param("subtaskId")

	var parentTaskID string
	// Fetch subtask details via Service to authenticate user has access to parent task
	dbSubtask, err := h.taskService.UpdateSubtask(c.Request.Context(), subtaskId, service.UpdateSubtaskRequest{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subtask not found"})
		return
	}
	parentTaskID = dbSubtask.TaskID
	_, ok := h.checkTaskMember(c, parentTaskID)
	if !ok {
		return
	}

	var req service.UpdateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.taskService.UpdateSubtask(c.Request.Context(), subtaskId, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *TaskHandler) DeleteSubtask(c *gin.Context) {
	subtaskId := c.Param("subtaskId")

	// Same auth check
	dbSubtask, err := h.taskService.UpdateSubtask(c.Request.Context(), subtaskId, service.UpdateSubtaskRequest{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subtask not found"})
		return
	}
	_, ok := h.checkTaskMember(c, dbSubtask.TaskID)
	if !ok {
		return
	}

	err = h.taskService.DeleteSubtask(c.Request.Context(), subtaskId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "subtask deleted successfully"})
}
