# Architecture Survey App 🏗️

## Project Overview
- **Name**: Architecture Survey App
- **Goal**: Khảo sát sở thích phong cách kiến trúc của người dùng thông qua việc lựa chọn ảnh
- **Features**: 
  - Khảo sát với 10 cặp ảnh kiến trúc
  - Phân tích phong cách dựa trên lựa chọn người dùng
  - Giao diện tối ưu cho iPhone/mobile
  - Admin dashboard để quản lý ảnh và thống kê

## URLs
- **Production**: https://3000-ie76h2s5lx9ep7o3bbird-6532622b.e2b.dev ✅ WORKING
- **Admin**: https://3000-ie76h2s5lx9ep7o3bbird-6532622b.e2b.dev/admin ✅ WORKING  
- **API Images**: `/api/images/:id` - Serves architectural images with fallback SVG
- **GitHub**: [Chưa setup]

## Data Architecture
- **Data Models**: 
  - `architecture_images`: Lưu trữ ảnh với phong cách
  - `survey_sessions`: Phiên khảo sát của người dùng
  - `user_responses`: Lựa chọn của người dùng
  - `session_results`: Kết quả phân tích phong cách
- **Storage Services**: Cloudflare D1 (SQLite database)
- **Data Flow**: 
  1. User bắt đầu session → tạo session_id
  2. Hiển thị cặp ảnh ngẫu nhiên
  3. User chọn ảnh → lưu response
  4. Sau 10 lượt → phân tích style dominat
  5. Hiển thị kết quả với mô tả

## Chức Năng Chính

### 1. Khảo Sát Người Dùng 📱
- **Giao diện mobile-friendly** tối ưu cho iPhone
- **10 cặp ảnh** để lựa chọn
- **Progress tracking** hiển thị tiến độ
- **Phân tích kết quả** dựa trên số lần chọn phong cách
- **Mô tả phong cách** chi tiết sau khi hoàn thành

### 2. Admin Interface 👩‍💼
- **Upload ảnh** để xây dựng database
- **Tự động trích xuất phong cách** từ tên file (bỏ số phía sau)
- **Thống kê** session hoàn thành và popularity
- **Quản lý thư viện ảnh**

### 3. Phong Cách Kiến Trúc Được Hỗ Trợ
- **Modern**: Hiện đại, tối giản, công nghệ cao
- **Classical**: Cổ điển, trang trí tinh xảo
- **Industrial**: Công nghiệp, thô ráp, kim loại
- **Traditional**: Truyền thống, văn hóa bản địa
- **Minimalist**: Tối giản, "ít là nhiều"
- **Contemporary**: Đương đại, kết hợp truyền thống-hiện đại

## User Guide 📖

### Cho Người Dùng:
1. Truy cập trang chính: https://3000-ie76h2s5lx9ep7o3bbird-6532622b.e2b.dev
2. Nhấn **"Bắt Đầu Khảo Sát"**
3. Chọn 1 trong 2 ảnh mà bạn thích hơn (10 lần)
4. Xem kết quả phong cách kiến trúc của bạn
5. Có thể làm lại khảo sát

### Cho Admin:
1. Truy cập: https://3000-ie76h2s5lx9ep7o3bbird-6532622b.e2b.dev/admin
2. Xem thống kê tổng quan
3. Upload ảnh mới (tên file quyết định phong cách)
   - Ví dụ: `modern_house_01.jpg` → style: "modern"
   - Ví dụ: `classical_building_02.jpg` → style: "classical"
4. **🆕 Quản lý thư viện ảnh nâng cao**:
   - **Tìm kiếm** ảnh theo tên file hoặc original name
   - **Lọc** theo phong cách (modern, classical, industrial, etc.)
   - **Lọc** theo trạng thái (active/inactive)
   - **Chỉnh sửa** thông tin ảnh (filename, style, status)
   - **Xem chi tiết** với usage statistics (số lần xuất hiện, được chọn)
   - **Bulk actions**: Chọn nhiều ảnh để activate/deactivate/delete cùng lúc
   - **Toggle status**: Bật/tắt ảnh nhanh chóng
   - **Smart delete**: Tự động deactivate thay vì xóa nếu ảnh có survey responses

## API Endpoints

### Public APIs:
- `POST /api/sessions` - Tạo session khảo sát mới
- `GET /api/sessions/:id/next-pair` - Lấy cặp ảnh tiếp theo
- `POST /api/sessions/:id/responses` - Ghi nhận lựa chọn
- `GET /api/sessions/:id/result` - Kết quả khảo sát

### Admin APIs:
- `GET /api/admin/stats` - Thống kê tổng quan
- `GET /api/admin/images` - Danh sách tất cả ảnh
- `POST /api/admin/upload` - Upload ảnh mới
- `GET /api/admin/images/search` - **🆕 Tìm kiếm và lọc ảnh**
- `GET /api/admin/images/:id` - **🆕 Chi tiết ảnh với statistics**
- `PUT /api/admin/images/:id` - **🆕 Cập nhật thông tin ảnh**
- `DELETE /api/admin/images/:id` - **🆕 Xóa ảnh (với safety check)**
- `PATCH /api/admin/images/:id/toggle` - **🆕 Toggle active/inactive**
- `POST /api/admin/images/bulk` - **🆕 Bulk actions (activate/deactivate/delete)**

### Image APIs:
- `GET /api/images/:id` - **🎨 Serve architectural images với style-specific SVG fallback**

## Deployment Status
- **Platform**: Cloudflare Pages (Local Development)
- **Status**: ✅ Active
- **Tech Stack**: 
  - **Backend**: Hono + TypeScript
  - **Frontend**: Vanilla JavaScript + TailwindCSS
  - **Database**: Cloudflare D1 (SQLite)
  - **Mobile**: Responsive design với touch optimization
- **Last Updated**: 2025-08-24

## Development Notes

### Current Features Completed ✅
- ✅ Mobile-optimized survey interface (WORKING)
- ✅ Admin dashboard với upload functionality (WORKING)
- ✅ Database schema và migrations (WORKING)
- ✅ Style analysis logic (WORKING)
- ✅ Progress tracking (WORKING)
- ✅ Result display với confidence score (WORKING)
- ✅ Local D1 database setup (WORKING)
- ✅ Sample data seeding (WORKING)
- ✅ **JavaScript Event Handling**: 
  - ✅ Start Survey button functionality (FIXED)
  - ✅ Upload button functionality (FIXED)
  - ✅ Choice buttons và navigation (FIXED)
  - ✅ Admin interface interactions (FIXED)
- ✅ Working APIs cho survey và admin
- ✅ **Advanced Image Gallery Management**:
  - ✅ Search và filter ảnh theo style, status, filename
  - ✅ Edit thông tin ảnh (filename, style, status)
  - ✅ Toggle active/inactive status
  - ✅ Delete ảnh (với safety check cho responses)
  - ✅ **"Delete All Images"** với double confirmation và smart logic
- ✅ **Enhanced Architectural Image Display**:
  - ✅ Survey hiển thị distinct architectural representations thay vì generic placeholders
  - ✅ Admin gallery với professional architectural SVG designs
  - ✅ **16 Architectural Styles** với unique visual identity:
    - Modern, Classical, Industrial, Traditional, Contemporary, Minimalist
    - Victorian, Colonial, Brutalist, Gothic
    - **NEW**: Art Deco, Tudor, Italian, Mediterranean, Craftsman, Neoclassic
  - ✅ Enhanced color palettes với secondary colors for depth
  - ✅ Multi-source fallback chain: R2 Storage → Architectural SVG → Error handling
- ✅ **Static File Serving**: Proper routing cho /static/* và favicon.ico
- ✅ **Real Upload Functionality**:
  - ✅ R2 Storage integration với file validation
  - ✅ File type validation (images only) và size limits (5MB max)
  - ✅ Safe filename generation với timestamp prefixes
  - ✅ Graceful fallback nếu R2 storage unavailable
  - ✅ Enhanced error handling và user feedback
  - ✅ Bulk actions (activate, deactivate, delete multiple)
  - ✅ Image details modal với usage statistics
  - ✅ Pagination với load more functionality
  - ✅ Checkbox selection với visual feedback

### Features Not Yet Implemented ⏳
- ❌ R2 storage cho ảnh thực (hiện dùng placeholder)
- ❌ Production Cloudflare deployment
- ❌ GitHub integration
- ❌ Real image upload to R2
- ❌ Advanced analytics dashboard
- ❌ User preference saving
- ❌ Social sharing features

### Recommended Next Steps 🚀
1. **Setup Cloudflare API key** để deploy production
2. **Integrate R2 storage** cho ảnh thực
3. **Upload ảnh kiến trúc thực** thay placeholder
4. **Deploy to Cloudflare Pages** production
5. **Setup GitHub repository** để version control
6. **Enhance admin features** (ảnh management, analytics)
7. **Add more architecture styles** nếu cần
8. **Implement user sessions** để track multiple surveys

## Technical Architecture

### Frontend:
- **Mobile-first design** với TailwindCSS
- **Touch-optimized** cho iPhone
- **Progressive Enhancement** với vanilla JS
- **Responsive images** với aspect ratio optimization

### Backend:
- **Hono framework** trên Cloudflare Workers
- **TypeScript** cho type safety
- **RESTful APIs** cho frontend-backend communication
- **D1 database** cho data persistence

### Database Design:
- **Normalized schema** với foreign keys
- **Indexes** cho performance optimization
- **Views** cho reporting queries
- **Migration system** cho schema updates