-- Migration 0004: Add user demographics support
-- Created: 2025-08-25
-- Purpose: Add user information collection for marketing analytics

-- Add demographics columns to survey_sessions
ALTER TABLE survey_sessions ADD COLUMN user_name TEXT;
ALTER TABLE survey_sessions ADD COLUMN user_email TEXT;
ALTER TABLE survey_sessions ADD COLUMN user_phone TEXT;
ALTER TABLE survey_sessions ADD COLUMN user_location TEXT;
ALTER TABLE survey_sessions ADD COLUMN user_age_range TEXT; -- '18-25', '26-35', '36-45', '46-55', '55+'
ALTER TABLE survey_sessions ADD COLUMN user_gender TEXT; -- 'male', 'female', 'other', 'prefer_not_to_say'

-- Create index for demographics analytics
CREATE INDEX IF NOT EXISTS idx_survey_sessions_demographics ON survey_sessions(user_age_range, user_gender, user_location, survey_category);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_email ON survey_sessions(user_email);

-- Create demographics analytics view
CREATE VIEW IF NOT EXISTS demographics_analytics AS
SELECT 
  survey_category,
  user_age_range,
  user_gender,
  user_location,
  COUNT(*) as session_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  ROUND(AVG(total_pairs), 2) as avg_pairs_completed
FROM survey_sessions 
WHERE user_name IS NOT NULL OR user_email IS NOT NULL
GROUP BY survey_category, user_age_range, user_gender, user_location;

-- Create popular styles by demographics view
CREATE VIEW IF NOT EXISTS style_popularity_by_demographics AS
SELECT 
  ss.survey_category,
  ss.user_age_range,
  ss.user_gender,
  ss.user_location,
  sr.dominant_style,
  COUNT(*) as preference_count,
  ROUND(AVG(sr.confidence_score), 2) as avg_confidence
FROM survey_sessions ss
JOIN session_results sr ON ss.id = sr.session_id
WHERE ss.status = 'completed' 
  AND (ss.user_name IS NOT NULL OR ss.user_email IS NOT NULL)
GROUP BY ss.survey_category, ss.user_age_range, ss.user_gender, ss.user_location, sr.dominant_style
ORDER BY ss.survey_category, preference_count DESC;