-- Cleanup old test sessions
-- Run this in Supabase SQL Editor to clean up stuck sessions

-- Option 1: Mark all old sessions as completed
UPDATE interview_sessions
SET status = 'completed',
    completed_at = NOW()
WHERE status = 'live'
  AND created_at < NOW() - INTERVAL '1 hour';  -- Only sessions older than 1 hour

-- Option 2: Delete all test sessions (nuclear option)
-- UNCOMMENT BELOW TO DELETE EVERYTHING AND START FRESH
-- WARNING: This will delete ALL data including artifacts, scores, events

-- DELETE FROM interview_sessions WHERE created_at < NOW() - INTERVAL '1 hour';

-- Option 3: Keep only the most recent session, delete the rest
-- UNCOMMENT BELOW TO KEEP ONLY LATEST SESSION

-- DELETE FROM interview_sessions
-- WHERE id NOT IN (
--   SELECT id FROM interview_sessions
--   ORDER BY created_at DESC
--   LIMIT 1
-- );

-- View current sessions after cleanup
SELECT
  id,
  status,
  created_at,
  started_at,
  completed_at,
  (SELECT COUNT(*) FROM artifacts WHERE session_id = interview_sessions.id) as artifacts,
  (SELECT COUNT(*) FROM scores WHERE session_id = interview_sessions.id) as scores
FROM interview_sessions
ORDER BY created_at DESC;
