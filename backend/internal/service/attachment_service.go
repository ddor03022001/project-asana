package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"backend/internal/domain"

	"github.com/google/uuid"
)

const MaxFileSize int64 = 5 * 1024 * 1024 // 5MB limit

type AttachmentService interface {
	SaveAttachment(ctx context.Context, taskID string, userID string, fileHeader *multipart.FileHeader) (*domain.Attachment, error)
	GetAttachmentsByTask(ctx context.Context, taskID string) ([]domain.Attachment, error)
	DeleteAttachment(ctx context.Context, attachmentID string) error
}

type attachmentService struct {
	attachmentRepo domain.AttachmentRepository
	uploadDir      string
}

func NewAttachmentService(attachmentRepo domain.AttachmentRepository, uploadDir string) AttachmentService {
	// Ensure upload directory exists
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	_ = os.MkdirAll(uploadDir, 0755)

	return &attachmentService{
		attachmentRepo: attachmentRepo,
		uploadDir:      uploadDir,
	}
}

func (s *attachmentService) SaveAttachment(ctx context.Context, taskID string, userID string, fileHeader *multipart.FileHeader) (*domain.Attachment, error) {
	if fileHeader.Size > MaxFileSize {
		return nil, fmt.Errorf("file size exceeds maximum limit of 5MB (size: %d bytes)", fileHeader.Size)
	}

	srcFile, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open uploaded file: %w", err)
	}
	defer srcFile.Close()

	// Generate safe unique filename
	ext := filepath.Ext(fileHeader.Filename)
	uniqueFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(s.uploadDir, uniqueFileName)

	dstFile, err := os.Create(dstPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create destination file on disk: %w", err)
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return nil, fmt.Errorf("failed to write file to disk: %w", err)
	}

	// Format web accessible URL path
	fileURL := fmt.Sprintf("/uploads/%s", uniqueFileName)
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	attachment := &domain.Attachment{
		TaskID:     taskID,
		UploadedBy: &userID,
		FileName:   fileHeader.Filename,
		FileURL:    fileURL,
		FileSize:   fileHeader.Size,
		MimeType:   mimeType,
	}

	if err := s.attachmentRepo.Create(ctx, attachment); err != nil {
		// Cleanup saved file on DB insert error
		_ = os.Remove(dstPath)
		return nil, fmt.Errorf("failed to save attachment record: %w", err)
	}

	return attachment, nil
}

func (s *attachmentService) GetAttachmentsByTask(ctx context.Context, taskID string) ([]domain.Attachment, error) {
	return s.attachmentRepo.FindAllByTaskID(ctx, taskID)
}

func (s *attachmentService) DeleteAttachment(ctx context.Context, attachmentID string) error {
	attachment, err := s.attachmentRepo.FindByID(ctx, attachmentID)
	if err != nil {
		return errors.New("attachment not found")
	}

	// Delete from DB first
	if err := s.attachmentRepo.Delete(ctx, attachmentID); err != nil {
		return err
	}

	// Delete physical file from disk
	fileName := filepath.Base(attachment.FileURL)
	if fileName != "" && !strings.Contains(fileName, "..") {
		filePath := filepath.Join(s.uploadDir, fileName)
		_ = os.Remove(filePath)
	}

	return nil
}
