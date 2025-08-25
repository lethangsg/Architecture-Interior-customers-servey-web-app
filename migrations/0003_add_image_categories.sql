-- Add support for multiple image categories (architecture and interior)

-- Add category column to architecture_images table
ALTER TABLE architecture_images ADD COLUMN category TEXT DEFAULT 'architecture';

-- Update existing records to be architecture category
UPDATE architecture_images SET category = 'architecture' WHERE category IS NULL;

-- Create index for category
CREATE INDEX IF NOT EXISTS idx_architecture_images_category ON architecture_images(category);

-- Add category to survey sessions to track survey type
ALTER TABLE survey_sessions ADD COLUMN survey_category TEXT DEFAULT 'architecture';

-- Update existing sessions to be architecture category  
UPDATE survey_sessions SET survey_category = 'architecture' WHERE survey_category IS NULL;

-- Create index for survey category
CREATE INDEX IF NOT EXISTS idx_survey_sessions_category ON survey_sessions(survey_category);

-- Update style_popularity view to include category
DROP VIEW IF EXISTS style_popularity;

CREATE VIEW style_popularity AS
SELECT 
  ai.category,
  ai.style,
  COUNT(ur.chosen_image_id) as total_chosen,
  COUNT(DISTINCT ur.session_id) as unique_sessions,
  ROUND(AVG(ur.response_time), 2) as avg_response_time,
  COUNT(CASE WHEN ur.is_skipped = 1 THEN 1 END) as total_skipped
FROM user_responses ur
LEFT JOIN architecture_images ai ON ur.chosen_image_id = ai.id
LEFT JOIN survey_sessions ss ON ur.session_id = ss.id
WHERE ai.category IS NOT NULL
GROUP BY ai.category, ai.style
ORDER BY ai.category, total_chosen DESC;