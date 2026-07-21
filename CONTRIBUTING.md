# Hướng Dẫn Đóng Góp Dự Án (Contributing Guide)

Chào mừng bạn đến với dự án Quản lý công việc (Task Management App). Để duy trì chất lượng mã nguồn cao và giúp quy trình phát triển trơn tru, vui lòng tuân thủ các quy tắc và quy trình đóng góp dưới đây.

---

## 1. Quy trình phát triển (Git Workflow)

Chúng ta áp dụng mô hình **Feature Branching**:
* Nhánh `main` là nhánh sản phẩm chính, luôn ổn định và sẵn sàng deploy.
* Mọi thay đổi hoặc tính năng mới phải được phát triển trên một nhánh riêng và merge qua **Pull Request (PR)**.

### Quy ước đặt tên nhánh (Branch Naming)
* **Tính năng mới**: `feat/ten-tinh-nang` (ví dụ: `feat/google-oauth`)
* **Sửa lỗi**: `fix/ten-loi` (ví dụ: `fix/jwt-expiration`)
* **Tối ưu cấu trúc**: `refactor/ten-phan-viet-lai` (ví dụ: `refactor/user-service`)
* **Tài liệu**: `docs/ten-tai-lieu` (ví dụ: `docs/api-endpoints`)
* **Công việc phụ trợ**: `chore/ten-task` (ví dụ: `chore/update-dependencies`)

---

## 2. Quy chuẩn Commit (Conventional Commits)

Nội dung commit message cần viết rõ ràng theo định dạng [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Các tiền tố (Types) phổ biến:
* `feat`: Thêm tính năng mới.
* `fix`: Sửa lỗi.
* `docs`: Thay đổi tài liệu hướng dẫn.
* `style`: Thay đổi định dạng code (khoảng trắng, dấu chấm phẩy...) mà không đổi logic.
* `refactor`: Tái cấu trúc code nhưng không sửa lỗi hay thêm tính năng mới.
* `test`: Viết thêm unit test hoặc integration test.
* `chore`: Thay đổi cấu hình build, cập nhật dependencies hoặc các công việc phụ trợ.

*Ví dụ:* `feat(auth): tích hợp đăng nhập Google OAuth 2.0`

---

## 3. Quy chuẩn chất lượng Code (Code Quality & Linting)

Trước khi commit code, hệ thống git hook cục bộ (`pre-commit`) sẽ tự động chạy để kiểm tra code:
* **Backend Go**: Sử dụng `golangci-lint` kiểm tra lỗi cú pháp, style và biến không sử dụng.
* **Frontend React/Next.js**: Sử dụng `ESLint` kết hợp `Prettier` tự động căn chỉnh và phát hiện lỗi.

### Hướng dẫn cài đặt Git Hook cục bộ:
Nếu bạn là người mới clone dự án về máy, hãy chạy lệnh dưới đây để kích hoạt hook tự động:
* Trên Windows (PowerShell):
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\setup-hooks.ps1
  ```
* Trên Linux/macOS/Git Bash:
  ```sh
  sh scripts/setup-hooks.sh
  ```

---

## 4. Cách chạy dự án dưới Local (Local Development)

### Backend Go:
1. Yêu cầu đã cài **Go 1.21+** và **Docker/Docker Desktop**.
2. Di chuyển vào thư mục backend: `cd backend`
3. Khởi động PostgreSQL & Redis: `docker compose up -d`
4. Copy cấu hình mẫu và điền tham số: `cp .env.example .env`
5. Chạy database migrations: `go run cmd/migrate/main.go up`
6. Chạy ứng dụng: `go run cmd/api/main.go`

### Frontend Next.js:
1. Yêu cầu đã cài **Node.js 18+**.
2. Di chuyển vào thư mục frontend: `cd frontend`
3. Cài đặt dependencies: `npm install`
4. Khởi động dev server: `npm run dev`
5. Định dạng lại toàn bộ code: `npm run format`
6. Chạy linter kiểm tra: `npm run lint`
