-- Update schema to support 3 images and skip option

-- Add third image column to user_responses table
ALTER TABLE user_responses ADD COLUMN image_third_id INTEGER;

-- Add foreign key constraint for third image (will be applied when creating new tables)
-- Note: SQLite doesn't support adding foreign key constraints to existing tables

-- Add skip option column - NULL means normal choice, 1 means skipped
ALTER TABLE user_responses ADD COLUMN is_skipped BOOLEAN DEFAULT 0;

-- Update the style_popularity view to handle the new schema
DROP VIEW IF EXISTS style_popularity;

CREATE VIEW style_popularity AS
SELECT 
  ai.style,
  COUNT(ur.chosen_image_id) as total_chosen,
  COUNT(DISTINCT ur.session_id) as unique_sessions,
  ROUND(AVG(ur.response_time), 2) as avg_response_time,
  COUNT(CASE WHEN ur.is_skipped = 1 THEN 1 END) as total_skipped
FROM user_responses ur
LEFT JOIN architecture_images ai ON ur.chosen_image_id = ai.id
GROUP BY ai.style
ORDER BY total_chosen DESC;

-- Create index for the new columns
CREATE INDEX IF NOT EXISTS idx_user_responses_third ON user_responses(image_third_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_skipped ON user_responses(is_skipped);