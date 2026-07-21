# Kế Hoạch Xây Dựng Phần Mềm Quản Lý Công Việc (Kiểu Asana)
### Solo dev | Backend: Go | Frontend: React/Next.js | DB: PostgreSQL | Thời gian: 8 tuần (~40 ngày làm việc)

---

## Ngăn xếp công nghệ đề xuất

| Thành phần | Công nghệ |
|---|---|
| Backend | Go (Gin hoặc Echo framework) |
| Database | PostgreSQL |
| ORM/Query | sqlc hoặc GORM |
| Auth | JWT + refresh token + Google OAuth 2.0 (đăng nhập bằng Google) |
| Email | Resend hoặc SendGrid (gửi mail mời thành viên) |
| Realtime | WebSocket (gorilla/websocket) hoặc Server-Sent Events |
| Cache/Queue | Redis (cho notification, session) |
| Frontend | React + Next.js + TailwindCSS |
| Kanban drag-drop | dnd-kit hoặc react-beautiful-dnd |
| State management | Zustand hoặc React Query (TanStack Query) |
| Deploy | Docker + VPS (hoặc Railway/Render) + Vercel (frontend) |

**Giả định:** bạn code full-time, khoảng 6-7 giờ/ngày, 5 ngày/tuần (nghỉ T7-CN để buffer/học thêm). Nếu bạn code ít giờ hơn/ngày, nhân đôi timeline.

---

## Nguyên tắc "làm chỉnh chu" (vì team sẽ dùng thật + bạn muốn học sâu)

Vì đây vừa là sản phẩm nội bộ team dùng thật, vừa là nơi bạn học, nên đầu tư thêm vào 4 việc sau — chúng không tốn nhiều thời gian nhưng nâng chất lượng lên hẳn, và mỗi việc cũng là một bài học kỹ thuật đáng giá:

**1. Kiến trúc rõ ràng ngay từ đầu (Clean/Layered Architecture cho Go)**
```
cmd/api/main.go          → điểm khởi động, wire dependencies
internal/handler/        → HTTP layer (parse request, trả response)
internal/service/        → business logic (không biết gì về HTTP hay SQL)
internal/repository/     → data access (chỉ biết SQL, không biết business logic)
internal/domain/         → struct + interface dùng chung
internal/middleware/     → auth, logging, recovery
pkg/                     → code dùng lại được, không gắn logic riêng của app
```
Tách lớp như vậy giúp: test dễ hơn (mock repository khi test service), đổi DB/framework sau này không vỡ toàn bộ code, và đây cũng chính là pattern bạn sẽ gặp lại ở hầu hết dự án Go nghiêm túc — học một lần, dùng cả sự nghiệp.

**2. Coding convention & tooling ngay từ Ngày 2**
- `golangci-lint` chạy trước mỗi commit (bắt lỗi style, unused var, error không xử lý)
- Quy ước xử lý lỗi nhất quán: wrap error bằng `fmt.Errorf("...: %w", err)`, không bao giờ `panic` trong service/handler
- Quy ước đặt tên: package theo domain (không đặt `utils`, `helpers` chung chung)
- Prettier + ESLint cho phần frontend

**3. Git workflow chuyên nghiệp dù chỉ 1 mình**
- Mỗi feature 1 branch (`feat/task-crud`, `fix/jwt-refresh`)
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) — sau này dễ generate changelog
- Tự tạo Pull Request và tự review trước khi merge vào `main` — thói quen này quan trọng khi team lớn hơn sau này
- README cập nhật liên tục: cách chạy local, cấu trúc thư mục, biến môi trường cần có

**4. Ghi lại quyết định kỹ thuật (Architecture Decision Records — ADR)**
Mỗi khi chọn giữa 2 phương án (ví dụ: GORM vs sqlc, REST vs GraphQL, JWT vs session), viết 1 file ngắn trong `docs/adr/` gồm: bối cảnh, các lựa chọn đã cân nhắc, quyết định cuối, lý do. Đây là thói quen của kỹ sư senior — vừa giúp bạn nhớ lại sau này, vừa là tài liệu học tập cực tốt vì bạn buộc phải hiểu rõ trade-off trước khi quyết định.

**Đề xuất điều chỉnh timeline:** với mức độ chỉnh chu này, nên cộng thêm **buffer 20%** (~8 ngày) rải đều vào các tuần thay vì dồn cuối — ví dụ mỗi tuần dành thêm nửa ngày để refactor, viết doc, hoặc đọc thêm về pattern mới học được trong tuần. Tổng thời gian thực tế nên tính khoảng **9-10 tuần** thay vì đúng 8 tuần.

---

## Thiết kế sẵn sàng mở rộng quy mô (Scale-ready from Day 1)

Nguyên tắc: **quyết định đúng ngay từ đầu thì gần như không tốn thêm thời gian** — chỉ tốn nhiều nếu phải làm lại sau khi đã có dữ liệu thật. Chia làm 3 nhóm để bạn biết cái gì cần làm ngay, cái gì để dành.

### ✅ Nhóm 1 — Làm ngay từ Tuần 1-2 (gần như miễn phí, cực đắt nếu sửa sau)

| Việc | Vì sao quan trọng |
|---|---|
| Dùng **UUID** làm primary key (không dùng auto-increment int) | Đổi từ int sang UUID sau này khi đã có dữ liệu là ác mộng (phải sửa toàn bộ FK). UUID cũng an toàn hơn khi lộ ID qua URL. |
| Mọi bảng nghiệp vụ đều có `workspace_id` (tenant_id) ngay từ đầu, kể cả khi hiện tại 1 workspace = 1 công ty | Đây chính là nền móng multi-tenancy. Thiếu cột này ngay từ đầu = phải migrate dữ liệu cực đau đớn khi công ty lớn cần tách dữ liệu theo phòng ban/chi nhánh. |
| **Stateless auth** (JWT, không lưu session trong RAM server) | Cho phép chạy nhiều instance backend song song (horizontal scale) mà không cần sticky session. Bạn đã làm đúng việc này rồi. |
| Config qua biến môi trường, **không hardcode** bất cứ gì (DB host, secret, giới hạn...) | Bắt buộc để deploy nhiều môi trường (dev/staging/prod) và scale ngang. |
| **Pagination** cho mọi API trả list (không bao giờ trả "lấy hết") | 10 task thì list-all không sao, 100,000 task thì sập server. Thêm ngay từ đầu rẻ hơn nhiều so với thêm sau khi FE đã quen gọi API không phân trang. |
| **Index DB đúng chỗ** ngay khi tạo bảng (không đợi chậm mới thêm) | `workspace_id`, `project_id`, `assignee_id`, `status`, `due_date` — đây là các cột sẽ luôn filter/join. |
| **Structured logging** (JSON log, có request_id xuyên suốt 1 request) | Khi có 5 instance backend chạy song song, log dạng text thường không debug nổi con nào lỗi lúc nào. |
| Tách code theo **domain module** rõ ràng (đã có trong layered architecture ở trên) | Đây là bước đệm để sau này tách microservice (nếu thật sự cần) mà không phải viết lại từ đầu. |

### 🔜 Nhóm 2 — Chuẩn bị sẵn "móc nối", bật lên khi cần (Tuần 5-7, không tốn nhiều thêm)

| Việc | Khi nào cần bật |
|---|---|
| **Redis cache** cho dữ liệu hay đọc (danh sách project, thông tin user) | Khi số lượng user > vài trăm và DB bắt đầu chịu tải đọc lớn |
| **Redis Pub/Sub cho WebSocket** (thay vì WebSocket giữ state trong RAM của 1 instance) | Bắt buộc ngay khi bạn chạy 2+ instance backend — nếu không, user A nối vào instance 1 sẽ không nhận được notification được bắn từ instance 2. Nên làm việc này ngay ở Tuần 5 khi build WebSocket, đỡ phải sửa lại. |
| **Queue cho tác vụ nặng/không cần realtime** (gửi email mời, tính báo cáo) — dùng Redis queue (Asynq) là đủ, chưa cần Kafka/RabbitMQ | Khi lượng email/report tăng, tránh block request chính |
| **Read replica** cho Postgres | Khi query đọc (dashboard, report) bắt đầu ảnh hưởng tốc độ ghi task |
| **Rate limiting theo workspace** (không chỉ theo IP) | Khi có nhiều công ty dùng chung hệ thống (multi-tenant SaaS thật sự) — tránh 1 tenant dùng nhiều làm chậm tenant khác |
| **Audit log đầy đủ** (ai xem/sửa/xóa gì, lúc nào, từ IP nào) | Doanh nghiệp/tập đoàn thường yêu cầu bắt buộc cho compliance (SOC2, ISO 27001...) |
| **RBAC chi tiết hơn** (không chỉ owner/admin/member mà theo từng permission cụ thể: ai được xóa task, ai được export data...) | Khi tổ chức lớn, phân quyền theo phòng ban/chức vụ phức tạp hơn nhiều so với team nhỏ |

### ⏸️ Nhóm 3 — Để dành, đừng làm sớm (tránh over-engineering)

- **Microservices** — modular monolith (kiến trúc layered ở trên) đã đủ tách domain rõ ràng; tách service thật sự chỉ khi 1 module cần scale độc lập hẳn (ví dụ notification service nhận traffic gấp 100 lần API chính)
- **Kubernetes** — Docker Compose hoặc 1 VPS mạnh là đủ cho tới hàng chục nghìn user; K8s thêm độ phức tạp vận hành lớn mà bạn (solo dev) sẽ phải tự gánh
- **Database sharding** — chỉ cần khi 1 bảng vượt hàng chục triệu dòng và đã tối ưu index/query hết mức
- **SSO/SAML doanh nghiệp (Okta, Azure AD)** — thêm sau khi có khách hàng doanh nghiệp thật sự yêu cầu; Google OAuth đã đủ cho giai đoạn đầu, và code auth đã tách lớp nên thêm provider mới sau này không khó
- **Multi-region deployment** — chỉ cần khi có user ở nhiều châu lục và độ trễ mạng thật sự là vấn đề

**Tóm lại:** Nhóm 1 làm ngay không hỏi tại sao. Nhóm 2 code sẵn "điểm nối" (interface, abstraction) nhưng chưa cần bật hết công suất — ví dụ viết cache layer qua interface `Cache` để sau này đổi implementation không phải sửa chỗ gọi. Nhóm 3 thì kệ nó, đừng để FOMO về "kiến trúc lớn" làm bạn chậm MVP.

---

## TUẦN 1 — Nền móng: thiết kế hệ thống & Auth

**Mục tiêu tuần:** Xong thiết kế DB, khởi tạo repo, API auth hoàn chỉnh.

### Ngày 1 (Thứ 2) — 6h
- (2h) Xác định phạm vi MVP: liệt kê chính xác feature nào có trong MVP (workspace, project, task, subtask, comment, board view, list view) và feature nào để sau (calendar, timeline/Gantt, automation)
- (2h) Vẽ ERD (Entity Relationship Diagram) cho DB: `users`, `workspaces`, `workspace_members`, `projects`, `project_members`, `tasks`, `subtasks`, `comments`, `tags`, `task_tags`, `attachments`, `notifications`
- (2h) Thiết kế API routes tổng thể (REST) — liệt kê endpoint theo resource

### Ngày 2 (Thứ 3) — 6h
- (1h) Setup Go module, cấu trúc thư mục theo chuẩn (`cmd/`, `internal/`, `pkg/`, `migrations/`)
- (2h) Setup PostgreSQL local (Docker Compose), viết migration đầu tiên (users, workspaces) — **dùng UUID làm primary key** cho mọi bảng, thêm `created_at`/`updated_at` chuẩn hóa
- (2h) Setup Gin/Echo, middleware cơ bản (CORS, logger dạng JSON có request_id, recover)
- (1h) Setup `.env` config, viết config loader (không hardcode bất kỳ giá trị nào)

### Ngày 3 (Thứ 4) — 6h
- (1h) Viết model + repository layer cho `User` (không cần trường password nếu chỉ dùng Google login — hoặc để nullable nếu muốn hỗ trợ cả 2 cách)
- (3h) Tích hợp Google OAuth 2.0: đăng ký OAuth client trên Google Cloud Console, viết endpoint `/auth/google` (redirect) và `/auth/google/callback` (đổi code lấy thông tin user)
- (2h) Logic: nếu email Google đã tồn tại → login, chưa tồn tại → tự tạo user mới (lấy tên, avatar từ Google trả về)

### Ngày 4 (Thứ 5) — 6h
- (2h) Sinh JWT access token + refresh token sau khi xác thực Google thành công
- (2h) Middleware xác thực JWT, API refresh token, logout (blacklist token qua Redis hoặc DB)
- (2h) Test toàn bộ luồng đăng nhập Google bằng Postman + trên trình duyệt thật

### Ngày 5 (Thứ 6) — 6h
- (2h) API workspace: tạo workspace, bảng `workspace_members` với roles (owner, admin, member)
- (3h) Tính năng mời thành viên qua email: bảng `invitations` (email, workspace_id, role, token, expires_at), API tạo lời mời + gửi email qua Resend/SendGrid chứa link `app.com/invite/accept?token=...`
- (1h) API accept invitation: verify token, nếu user đã đăng nhập Google với đúng email → tự join workspace luôn

**Checklist cuối tuần 1:** ✅ Auth hoàn chỉnh, ✅ Workspace CRUD + roles, ✅ DB schema base sẵn sàng

---

## TUẦN 2 — Core Backend: Project & Task API

**Mục tiêu tuần:** API đầy đủ cho project, task, subtask.

### Ngày 6 (Thứ 2) — 6h
- (2h) Migration bảng `projects`, `project_members`
- (2h) API CRUD project (tạo/sửa/xóa/list theo workspace)
- (2h) API thêm/xóa thành viên vào project

### Ngày 7 (Thứ 3) — 6h
- (2h) Migration bảng `tasks` (title, description, status, priority, due_date, assignee_id, project_id, position)
- (2h) API tạo task, sửa task, xóa task (soft delete)
- (2h) API list task theo project với filter (status, assignee, priority) và **pagination** (limit/offset hoặc cursor-based)

### Ngày 8 (Thứ 4) — 6h
- (2h) API cập nhật trạng thái task (cho kanban: to-do, in-progress, done — dùng cột `status` hoặc bảng `columns` riêng để tùy biến)
- (2h) Logic `position` (thứ tự sắp xếp task trong cột) — dùng kiểu float hoặc fractional indexing để kéo-thả mượt
- (2h) API subtask (bảng `subtasks` liên kết `task_id`, hoặc self-referencing `parent_task_id`)

### Ngày 9 (Thứ 5) — 6h
- (2h) API comment cho task (`comments` bảng, liên kết task_id, user_id)
- (2h) API tag/label (`tags`, `task_tags` bảng many-to-many)
- (2h) API gán nhiều assignee cho 1 task (nếu muốn giống Asana — multi-assignee) hoặc single assignee (đơn giản hơn)

### Ngày 10 (Thứ 6) — 6h
- (2h) API attachment (upload file — dùng local storage hoặc S3/MinIO, lưu metadata trong DB)
- (2h) Viết unit test cho các service quan trọng (task service, project service)
- (2h) Review & refactor code, viết Swagger/OpenAPI doc cho toàn bộ API

**Checklist cuối tuần 2:** ✅ Project/Task/Subtask CRUD đầy đủ, ✅ Comment, Tag, Attachment, ✅ API doc

---

## TUẦN 3 — Frontend nền tảng + Auth UI

**Mục tiêu tuần:** Setup frontend, giao diện đăng nhập, layout chính, danh sách project.

### Ngày 11 (Thứ 2) — 6h
- (1h) Setup Next.js project, TailwindCSS, cấu trúc thư mục (`app/`, `components/`, `lib/`, `hooks/`)
- (2h) Setup React Query + Axios client (interceptor tự gắn JWT, tự refresh token khi 401)
- (3h) Thiết kế UI kit cơ bản: Button, Input, Modal, Dropdown, Avatar, Badge (dùng component tái sử dụng)

### Ngày 12 (Thứ 3) — 6h
- (2h) Trang đăng nhập: nút "Đăng nhập với Google" (redirect qua BE `/auth/google`), xử lý callback nhận JWT và lưu vào cookie/localStorage
- (2h) Layout chính: sidebar (danh sách workspace/project), topbar (search, avatar, notification icon)
- (1h) Context/store quản lý user hiện tại đăng nhập (Zustand)
- (1h) Trang "Chấp nhận lời mời" (`/invite/accept?token=...`): hiển thị tên workspace được mời, nút xác nhận → nếu chưa đăng nhập thì dẫn qua Google login trước

### Ngày 13 (Thứ 4) — 6h
- (2h) Trang danh sách workspace, modal tạo workspace mới
- (2h) Trang mời thành viên vào workspace (input email, chọn role)
- (2h) Trang danh sách project trong workspace (dạng card/grid)

### Ngày 14 (Thứ 5) — 6h
- (2h) Modal/trang tạo project mới (chọn tên, màu, icon)
- (2h) Trang chi tiết project — khung sườn (tabs: List / Board / Calendar)
- (2h) Kết nối API thật, xử lý loading/error state

### Ngày 15 (Thứ 6) — 6h
- (3h) Component "Task List View" — bảng danh sách task, có thể sort theo cột, group theo status/assignee
- (2h) Modal chi tiết task (mở khi click vào 1 task): title, description, assignee, due date, priority
- (1h) Kết nối API update task ngay trong modal (inline edit)

**Checklist cuối tuần 3:** ✅ Auth UI hoàn chỉnh, ✅ Layout chính, ✅ List View hoạt động với API thật

---

## TUẦN 4 — Kanban Board (tính năng lõi giống Asana/Trello)

**Mục tiêu tuần:** Board view kéo-thả hoàn chỉnh.

### Ngày 16 (Thứ 2) — 6h
- (2h) Thiết kế component Board: cột (status columns) + card (task)
- (2h) Cài đặt dnd-kit, setup DndContext cơ bản
- (2h) Kéo-thả task giữa các cột, cập nhật `status` qua API

### Ngày 17 (Thứ 3) — 6h
- (2h) Kéo-thả sắp xếp thứ tự trong cùng 1 cột (cập nhật `position`)
- (2h) Tối ưu optimistic update (UI cập nhật ngay, rollback nếu API lỗi) qua React Query
- (2h) Thêm/xóa/đổi tên cột tùy chỉnh (nếu muốn linh hoạt như Asana boards)

### Ngày 18 (Thứ 4) — 6h
- (2h) Card task hiển thị: avatar assignee, due date, priority badge, số lượng subtask/comment
- (2h) Filter trên board: theo assignee, theo tag, theo priority
- (2h) Search task trong project (search theo title)

### Ngày 19 (Thứ 5) — 6h
- (3h) Trang chi tiết task đầy đủ (full page hoặc side panel): mô tả rich text (dùng Tiptap editor), subtask checklist, đính kèm file
- (2h) Kết nối API subtask: thêm/tick hoàn thành/xóa subtask ngay trong panel
- (1h) Upload file đính kèm từ UI

### Ngày 20 (Thứ 6) — 6h
- (2h) Comment section trong task detail — hiển thị realtime-ish (poll hoặc websocket sau)
- (2h) Assign nhiều người, đổi priority, đổi due date từ task detail
- (2h) Testing thủ công toàn bộ luồng: tạo project → tạo task → kéo thả → sửa chi tiết

**Checklist cuối tuần 4:** ✅ Kanban board kéo-thả mượt, ✅ Task detail đầy đủ tính năng

---

## TUẦN 5 — Calendar View, Notification, Search nâng cao

### Ngày 21 (Thứ 2) — 6h
- (3h) API endpoint tổng hợp task theo khoảng thời gian (cho calendar)
- (3h) Component Calendar View (dùng react-big-calendar hoặc FullCalendar) hiển thị task theo due date

### Ngày 22 (Thứ 3) — 6h
- (2h) Kéo-thả task trên calendar để đổi due date
- (2h) Click vào ngày để tạo task nhanh với due date đó
- (2h) Toggle qua lại List / Board / Calendar view mượt mà

### Ngày 23 (Thứ 4) — 6h
- (2h) Migration bảng `notifications`
- (2h) Trigger tạo notification khi: được assign task, có comment mới, task sắp đến hạn
- (2h) API list notification, đánh dấu đã đọc

### Ngày 24 (Thứ 5) — 6h
- (3h) UI dropdown notification (chuông thông báo ở topbar), realtime badge số lượng chưa đọc
- (3h) Setup WebSocket server (Go, gorilla/websocket) **kết hợp Redis Pub/Sub** để đẩy notification realtime — làm ngay từ đầu để sau này chạy nhiều instance backend không bị mất kết nối chéo instance

### Ngày 25 (Thứ 6) — 6h
- (2h) Kết nối WebSocket client (reconnect logic, xử lý mất kết nối)
- (2h) Global search: tìm task/project theo từ khóa (search API dùng ILIKE hoặc Postgres full-text search)
- (2h) UI global search (Cmd+K command palette style)

**Checklist cuối tuần 5:** ✅ Calendar view, ✅ Notification realtime, ✅ Global search

---

## TUẦN 6 — Team Collaboration & Permission nâng cao

### Ngày 26 (Thứ 2) — 6h
- (2h) Trang quản lý thành viên workspace: đổi role, xóa thành viên
- (2h) Trang profile cá nhân: đổi avatar, tên, mật khẩu
- (2h) Middleware phân quyền chi tiết hơn (ai được sửa/xóa task nào)

### Ngày 27 (Thứ 3) — 6h
- (2h) Trang "My Tasks" — tổng hợp tất cả task được assign cho tôi trên mọi project
- (2h) Dashboard tổng quan workspace: số task theo trạng thái, biểu đồ đơn giản (recharts)
- (2h) Activity log cho project (ai làm gì lúc nào) — bảng `activity_logs`

### Ngày 28 (Thứ 4) — 6h
- (3h) Tính năng recurring task (task lặp lại — nếu muốn nâng cao) HOẶC bỏ qua nếu ưu tiên thời gian
- (3h) Tính năng dependency giữa task (task này chờ task kia xong) — optional cho MVP, có thể để sau

### Ngày 29 (Thứ 5) — 6h
- (3h) Responsive UI cho mobile/tablet (kiểm tra và sửa layout board/list trên màn nhỏ)
- (3h) Dark mode (nếu muốn) hoặc tối ưu UX chi tiết (empty state, skeleton loading)

### Ngày 30 (Thứ 6) — 6h
- (3h) Rà soát toàn bộ UX: đặt tên nút rõ ràng, thêm confirm dialog khi xóa
- (3h) Sửa bug phát sinh từ việc test thủ công tuần trước

**Checklist cuối tuần 6:** ✅ My Tasks, Dashboard, Activity log, ✅ Responsive, ✅ UX polish

---

## TUẦN 7 — Testing, Bảo mật, Tối ưu hiệu năng

### Ngày 31 (Thứ 2) — 6h
- (3h) Viết integration test cho các API chính (Go — dùng `httptest`)
- (3h) Viết test cho authorization (đảm bảo user A không sửa được task của workspace user B)

### Ngày 32 (Thứ 3) — 6h
- (2h) Audit bảo mật cơ bản: SQL injection (đảm bảo dùng parameterized query), XSS (sanitize input rich text)
- (2h) Rate limiting cho API (chống spam login, brute force)
- (2h) Kiểm tra CORS, HTTPS config, secret trong `.env` không leak

### Ngày 33 (Thứ 4) — 6h
- (2h) Tối ưu query DB: thêm index cho các cột hay filter (project_id, status, assignee_id, due_date)
- (2h) Kiểm tra N+1 query, dùng eager loading/join hợp lý
- (2h) Cấu hình connection pool cho Postgres

### Ngày 34 (Thứ 5) — 6h
- (3h) Test tải cơ bản (dùng k6 hoặc Apache Bench) cho các API hay dùng nhất
- (3h) Tối ưu bundle frontend (code splitting, lazy load các trang ít dùng)

### Ngày 35 (Thứ 6) — 6h
- (3h) Sửa toàn bộ bug tồn đọng từ test tuần này
- (3h) Viết lại error handling nhất quán (format lỗi trả về API, toast lỗi ở FE)

**Checklist cuối tuần 7:** ✅ Test coverage cho core API, ✅ Bảo mật cơ bản, ✅ Performance tối ưu

---

## TUẦN 8 — Deploy, Tài liệu, Ra mắt

### Ngày 36 (Thứ 2) — 6h
- (2h) Viết Dockerfile cho backend Go (multi-stage build cho binary nhẹ)
- (2h) Docker Compose production (backend + Postgres + Redis)
- (2h) Setup CI cơ bản (GitHub Actions: chạy test + build khi push)

### Ngày 37 (Thứ 3) — 6h
- (2h) Deploy backend lên VPS/Railway/Render, cấu hình domain + SSL
- (2h) Deploy frontend lên Vercel, cấu hình biến môi trường
- (2h) Setup database production, chạy migration, seed dữ liệu demo

### Ngày 38 (Thứ 4) — 6h
- (3h) Test toàn bộ luồng trên môi trường production (đăng ký → tạo workspace → tạo task → kéo thả → notification)
- (3h) Sửa các vấn đề phát sinh do khác biệt môi trường (CORS, env, cookie domain)

### Ngày 39 (Thứ 5) — 6h
- (2h) Setup monitoring cơ bản (log tập trung, uptime monitor như UptimeRobot)
- (2h) Setup backup tự động cho DB (cron backup Postgres)
- (2h) Viết README, tài liệu API cho chính mình dùng sau này

### Ngày 40 (Thứ 6) — 6h
- (2h) Landing page giới thiệu sản phẩm (nếu định public)
- (2h) Chuẩn bị demo/video giới thiệu tính năng
- (2h) Rà soát checklist MVP lần cuối, lên kế hoạch v2 (những gì để sau: Gantt chart, automation, tích hợp Slack/email, mobile app...)

**Checklist cuối tuần 8:** ✅ Đã deploy production, ✅ Monitoring/backup, ✅ MVP sẵn sàng ra mắt

---

## Tổng kết lộ trình

| Tuần | Trọng tâm |
|---|---|
| 1 | Auth + Workspace API |
| 2 | Project/Task/Subtask API |
| 3 | Frontend nền tảng + List View |
| 4 | Kanban Board kéo-thả |
| 5 | Calendar + Notification realtime |
| 6 | Collaboration + Dashboard |
| 7 | Testing + Bảo mật + Performance |
| 8 | Deploy + Ra mắt |

## Lời khuyên thực tế
- **Đừng làm quá nhiều tính năng cùng lúc.** Asana thật có hàng trăm tính năng (Timeline/Gantt, Portfolio, Automation Rules, Forms...) — MVP của bạn chỉ cần List + Board + Calendar + Comment là đủ dùng thực tế.
- **Ưu tiên fractional indexing** cho việc sắp xếp task khi kéo-thả — tránh phải update lại toàn bộ position của các task khác mỗi lần kéo.
- **Dùng React Query** thay vì tự quản lý loading/cache — tiết kiệm rất nhiều thời gian so với tự viết.
- Nếu deadline gấp hơn, có thể cắt: recurring task, task dependency, dark mode, activity log — đây là những phần "nice-to-have" không ảnh hưởng core.
- Buffer 20% thời gian cho bug không lường trước — lịch trên đã khá chặt cho 1 người.
- **Vì team sẽ dùng thật:** đừng cắt Tuần 7 (testing/bảo mật) và phần backup DB ở Tuần 8 dù có gấp đến đâu — mất dữ liệu công việc thật của team là rủi ro không đáng đánh đổi để tiết kiệm vài ngày.
- **Vì bạn muốn học sâu:** sau mỗi tuần, dành 15-20 phút viết lại 3 điều bạn vừa học được vào `docs/learnings.md` — thói quen nhỏ này giúp kiến thức đọng lại thay vì trôi qua khi code xong là quên.
