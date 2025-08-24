-- Dữ liệu mẫu cho ứng dụng khảo sát kiến trúc

-- Thêm ảnh mẫu (trong thực tế sẽ được upload qua admin)
INSERT OR IGNORE INTO architecture_images (filename, style, file_path, original_name) VALUES 
  ('modern_1.jpg', 'modern', '/images/modern_1.jpg', 'modern_minimalist_house_01.jpg'),
  ('modern_2.jpg', 'modern', '/images/modern_2.jpg', 'modern_glass_building_02.jpg'),
  ('modern_3.jpg', 'modern', '/images/modern_3.jpg', 'modern_concrete_structure_03.jpg'),
  
  ('classical_1.jpg', 'classical', '/images/classical_1.jpg', 'classical_column_building_01.jpg'),
  ('classical_2.jpg', 'classical', '/images/classical_2.jpg', 'classical_baroque_palace_02.jpg'),
  ('classical_3.jpg', 'classical', '/images/classical_3.jpg', 'classical_neoclassical_museum_03.jpg'),
  
  ('industrial_1.jpg', 'industrial', '/images/industrial_1.jpg', 'industrial_loft_conversion_01.jpg'),
  ('industrial_2.jpg', 'industrial', '/images/industrial_2.jpg', 'industrial_warehouse_style_02.jpg'),
  ('industrial_3.jpg', 'industrial', '/images/industrial_3.jpg', 'industrial_factory_conversion_03.jpg'),
  
  ('traditional_1.jpg', 'traditional', '/images/traditional_1.jpg', 'traditional_vietnamese_house_01.jpg'),
  ('traditional_2.jpg', 'traditional', '/images/traditional_2.jpg', 'traditional_wooden_structure_02.jpg'),
  ('traditional_3.jpg', 'traditional', '/images/traditional_3.jpg', 'traditional_pagoda_style_03.jpg'),
  
  ('minimalist_1.jpg', 'minimalist', '/images/minimalist_1.jpg', 'minimalist_white_cube_01.jpg'),
  ('minimalist_2.jpg', 'minimalist', '/images/minimalist_2.jpg', 'minimalist_clean_lines_02.jpg'),
  ('minimalist_3.jpg', 'minimalist', '/images/minimalist_3.jpg', 'minimalist_simple_form_03.jpg');

-- Session mẫu
INSERT OR IGNORE INTO survey_sessions (id, user_agent, status, total_pairs) VALUES 
  ('demo-session-001', 'Demo User Agent', 'completed', 10),
  ('demo-session-002', 'Demo User Agent', 'active', 5);

-- Responses mẫu cho demo session
INSERT OR IGNORE INTO user_responses (session_id, image_left_id, image_right_id, chosen_image_id, response_time) VALUES 
  ('demo-session-001', 1, 4, 1, 2500), -- Chọn modern thay vì classical
  ('demo-session-001', 2, 7, 2, 1800), -- Chọn modern thay vì industrial  
  ('demo-session-001', 3, 10, 3, 3200), -- Chọn modern thay vì traditional
  ('demo-session-001', 5, 8, 8, 2100), -- Chọn industrial thay vì classical
  ('demo-session-001', 6, 9, 9, 1900), -- Chọn industrial thay vì classical
  ('demo-session-001', 11, 1, 1, 2800), -- Chọn modern thay vì traditional
  ('demo-session-001', 12, 2, 2, 2200), -- Chọn modern thay vì minimalist
  ('demo-session-001', 13, 3, 13, 2600), -- Chọn minimalist thay vì modern
  ('demo-session-001', 14, 4, 14, 1700), -- Chọn minimalist thay vì classical
  ('demo-session-001', 15, 5, 15, 2400); -- Chọn minimalist thay vì classical

-- Kết quả phân tích cho demo session
INSERT OR IGNORE INTO session_results (session_id, dominant_style, style_scores, confidence_score, total_responses) VALUES 
  ('demo-session-001', 'modern', '{"modern": 4, "minimalist": 3, "industrial": 2, "classical": 0, "traditional": 0}', 0.7, 10);