-- Debug script for viewing scores data
-- Run this in Supabase SQL Editor (not Table Editor)

-- 1. View all scores
SELECT * FROM scores ORDER BY created_at DESC;

-- 2. View scores for specific session (replace with your session_id)
SELECT * FROM scores
WHERE session_id = 'f75e31be-9441-4fda-965a-8554d030bd55'
ORDER BY created_at DESC;

-- 3. Count scores per session
SELECT
  session_id,
  COUNT(*) as score_count,
  MAX(created_at) as latest_score
FROM scores
GROUP BY session_id;

-- 4. Check if RLS is enabled (should be false for testing)
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'scores';

-- 5. View all sessions with their score counts
SELECT
  s.id as session_id,
  s.status,
  c.name as candidate_name,
  j.title as job_title,
  COUNT(sc.id) as num_scores
FROM interview_sessions s
LEFT JOIN candidates c ON c.id = s.candidate_id
LEFT JOIN job_profiles j ON j.id = s.job_id
LEFT JOIN scores sc ON sc.session_id = s.id
GROUP BY s.id, s.status, c.name, j.title
ORDER BY s.created_at DESC;

-- 6. View latest scores with full details
SELECT
  sc.id,
  sc.session_id,
  sc.round_number,
  sc.overall_score,
  sc.dimension_scores,
  sc.recommendation,
  sc.created_at,
  c.name as candidate_name
FROM scores sc
JOIN interview_sessions s ON s.id = sc.session_id
JOIN candidates c ON c.id = s.candidate_id
ORDER BY sc.created_at DESC
LIMIT 20;
