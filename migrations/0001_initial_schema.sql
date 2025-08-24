-- Architecture Survey Database Schema

-- Bảng lưu trữ ảnh kiến trúc
CREATE TABLE IF NOT EXISTS architecture_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  style TEXT NOT NULL, -- Phong cách kiến trúc (lấy từ tên file bỏ số)
  file_path TEXT NOT NULL, -- Đường dẫn file trong R2 storage
  original_name TEXT NOT NULL, -- Tên file gốc
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1 -- Cho phép admin tạm ẩn ảnh
);

-- Bảng lưu trữ session khảo sát
CREATE TABLE IF NOT EXISTS survey_sessions (
  id TEXT PRIMARY KEY, -- UUID
  user_agent TEXT,
  ip_address TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  total_pairs INTEGER DEFAULT 0, -- Số cặp ảnh đã chọn
  status TEXT DEFAULT 'active' -- active, completed, abandoned
);

-- Bảng lưu trữ từng lựa chọn của người dùng
CREATE TABLE IF NOT EXISTS user_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  image_left_id INTEGER NOT NULL, -- ID ảnh bên trái
  image_right_id INTEGER NOT NULL, -- ID ảnh bên phải
  chosen_image_id INTEGER NOT NULL, -- ID ảnh được chọn
  response_time INTEGER, -- Thời gian phản hồi (ms)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES survey_sessions(id),
  FOREIGN KEY (image_left_id) REFERENCES architecture_images(id),
  FOREIGN KEY (image_right_id) REFERENCES architecture_images(id),
  FOREIGN KEY (chosen_image_id) REFERENCES architecture_images(id)
);

-- Bảng thống kê kết quả theo session
CREATE TABLE IF NOT EXISTS session_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  dominant_style TEXT, -- Phong cách được chọn nhiều nhất
  style_scores TEXT, -- JSON lưu điểm số các phong cách {"modern": 5, "classic": 3, ...}
  confidence_score REAL, -- Độ tin cậy (0-1)
  total_responses INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES survey_sessions(id)
);

-- Tạo indexes để tối ưu hiệu suất
CREATE INDEX IF NOT EXISTS idx_architecture_images_style ON architecture_images(style);
CREATE INDEX IF NOT EXISTS idx_architecture_images_active ON architecture_images(is_active);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_status ON survey_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_responses_session ON user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_chosen ON user_responses(chosen_image_id);
CREATE INDEX IF NOT EXISTS idx_session_results_session ON session_results(session_id);

-- Tạo view để thống kê dễ dàng
CREATE VIEW IF NOT EXISTS style_popularity AS
SELECT 
  ai.style,
  COUNT(ur.chosen_image_id) as total_chosen,
  COUNT(DISTINCT ur.session_id) as unique_sessions,
  ROUND(AVG(ur.response_time), 2) as avg_response_time
FROM user_responses ur
JOIN architecture_images ai ON ur.chosen_image_id = ai.id
GROUP BY ai.style
ORDER BY total_chosen DESC;