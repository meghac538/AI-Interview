-- Debug script for session: e497860a-9d1d-43da-b224-82f8573a6cb2
-- Run this to check if data is being saved

-- 1. Check AI Assessments
SELECT
  'ai_assessments' as table_name,
  COUNT(*) as row_count
FROM ai_assessments
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2';

-- 2. View AI Assessments details
SELECT *
FROM ai_assessments
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2'
ORDER BY created_at DESC;

-- 3. Check Scores
SELECT
  'scores' as table_name,
  COUNT(*) as row_count
FROM scores
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2';

-- 4. View Scores details
SELECT *
FROM scores
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2'
ORDER BY created_at DESC;

-- 5. Check Live Events (should have voice_transcript events)
SELECT
  event_type,
  COUNT(*) as count
FROM live_events
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2'
GROUP BY event_type;

-- 6. Check Artifacts (transcript should be saved)
SELECT
  artifact_type,
  created_at
FROM artifacts
WHERE session_id = 'e497860a-9d1d-43da-b224-82f8573a6cb2';

-- 7. Check session status
SELECT
  status,
  started_at,
  completed_at
FROM interview_sessions
WHERE id = 'e497860a-9d1d-43da-b224-82f8573a6cb2';
