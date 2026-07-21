package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// EmailService defines the methods for sending system emails
type EmailService interface {
	SendInvitationEmail(ctx context.Context, toEmail string, workspaceName string, inviteURL string) error
}

type emailService struct {
	resendAPIKey string
}

// NewEmailService instantiates a new EmailService using Resend
func NewEmailService(resendAPIKey string) EmailService {
	return &emailService{resendAPIKey: resendAPIKey}
}

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (s *emailService) SendInvitationEmail(ctx context.Context, toEmail string, workspaceName string, inviteURL string) error {
	subject := fmt.Sprintf("Bạn được mời tham gia dự án trong Workspace %s", workspaceName)
	htmlContent := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
			<h2 style="color: #4f46e5; margin-bottom: 20px;">Lời mời tham gia Workspace</h2>
			<p>Xin chào,</p>
			<p>Bạn đã được mời tham gia vào không gian làm việc <strong>%s</strong> trên ứng dụng Quản lý công việc.</p>
			<p style="margin: 30px 0;">
				<a href="%s" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
					Chấp Nhận Lời Mời
				</a>
			</p>
			<p style="color: #64748b; font-size: 14px;">Nếu nút trên không hoạt động, bạn có thể sao chép liên kết dưới đây dán vào trình duyệt:</p>
			<p style="color: #4f46e5; font-size: 14px; word-break: break-all;">%s</p>
			<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
			<p style="color: #94a3b8; font-size: 12px;">Email này được gửi tự động từ hệ thống quản lý công việc.</p>
		</div>
	`, workspaceName, inviteURL, inviteURL)

	// Check if we should use mock console output
	if s.resendAPIKey == "" || s.resendAPIKey == "resend-api-key-placeholder" {
		slog.Info("📧 [MOCK EMAIL SENDER] Invitation email content:")
		slog.Info("-------------------------------------------------------------")
		slog.Info("TO      : " + toEmail)
		slog.Info("SUBJECT : " + subject)
		slog.Info("URL     : " + inviteURL)
		slog.Info("-------------------------------------------------------------")
		return nil
	}

	// Prepare payload for Resend API
	payload := resendPayload{
		From:    "onboarding@resend.dev", // Resend free tier sandbox domain
		To:      []string{toEmail},
		Subject: subject,
		HTML:    htmlContent,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("resend API returned bad status code: %d", resp.StatusCode)
	}

	slog.Info("invitation email sent successfully via Resend", "to", toEmail)
	return nil
}
