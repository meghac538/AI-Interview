-- Investigate session: a9ee3b4b-3b2d-404f-890a-8300c1b1f0da

-- 1. What artifacts exist for this session?
SELECT
  id,
  artifact_type,
  round_number,
  content,
  metadata,
  created_at
FROM artifacts
WHERE session_id = 'a9ee3b4b-3b2d-404f-890a-8300c1b1f0da'
ORDER BY created_at;

-- 2. What events were logged?
SELECT
  event_type,
  payload,
  created_at
FROM live_events
WHERE session_id = 'a9ee3b4b-3b2d-404f-890a-8300c1b1f0da'
ORDER BY created_at;

-- 3. What's the round status?
SELECT
  round_plan
FROM interview_scope_packages
WHERE session_id = 'a9ee3b4b-3b2d-404f-890a-8300c1b1f0da';

-- 4. What AI assessments exist?
SELECT
  observation,
  confidence,
  concern_level,
  created_at
FROM ai_assessments
WHERE session_id = 'a9ee3b4b-3b2d-404f-890a-8300c1b1f0da'
ORDER BY created_at;
