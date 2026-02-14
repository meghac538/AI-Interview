-- ============================================================
-- AI Interview Platform - Supabase MVP Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Job Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS job_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Remote',
  level_band TEXT NOT NULL CHECK (level_band IN ('junior', 'mid', 'senior')),
  track TEXT NOT NULL DEFAULT 'sales',
  role_success_criteria TEXT NOT NULL DEFAULT '',
  must_have_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  disqualifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  gating_thresholds JSONB NOT NULL DEFAULT '{"proceed": 70, "caution": 50, "stop": 30}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Candidates
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rippling_candidate_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  job_id TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'pi_scheduled', 'pi_passed', 'live_scheduled', 'live_completed', 'rejected', 'advanced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Interview Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id),
  job_id UUID REFERENCES job_profiles(id),
  session_type TEXT NOT NULL DEFAULT 'live',
  meeting_link TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  interviewer_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'aborted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Interview Scope Packages
-- ============================================================
CREATE TABLE IF NOT EXISTS interview_scope_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  track TEXT NOT NULL DEFAULT 'sales',
  round_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_set JSONB NOT NULL DEFAULT '{}'::jsonb,
  simulation_payloads JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubric_version TEXT NOT NULL DEFAULT '1.0',
  models_used JSONB NOT NULL DEFAULT '["gpt-4o"]'::jsonb,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Live Events (Immutable Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS live_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_events_session_id ON live_events(session_id);
CREATE INDEX IF NOT EXISTS idx_live_events_event_type ON live_events(event_type);

-- ============================================================
-- 6. Artifacts
-- ============================================================
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_session_id ON artifacts(session_id);

-- ============================================================
-- 7. Scores
-- ============================================================
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  overall_score NUMERIC NOT NULL DEFAULT 0,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0,
  evidence_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT NOT NULL DEFAULT 'caution' CHECK (recommendation IN ('proceed', 'caution', 'stop')),
  recommended_followups JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_session_id ON scores(session_id);

-- ============================================================
-- 8. Red Flags
-- ============================================================
CREATE TABLE IF NOT EXISTS red_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  description TEXT NOT NULL DEFAULT '',
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_red_flags_session_id ON red_flags(session_id);

-- ============================================================
-- 9. PI Screenings
-- ============================================================
CREATE TABLE IF NOT EXISTS pi_screenings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  resume_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  transcript JSONB,
  audio_url TEXT,
  pi_score_overall NUMERIC,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  pass_fail BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. Rippling Writebacks
-- ============================================================
CREATE TABLE IF NOT EXISTS rippling_writebacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('note', 'tag', 'stage_move')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Realtime for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE interview_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE interview_scope_packages;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE live_events;

-- ============================================================
-- Row Level Security (permissive for MVP - tighten for production)
-- ============================================================
ALTER TABLE job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_scope_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rippling_writebacks ENABLE ROW LEVEL SECURITY;

-- MVP: Allow all operations via anon key (service role bypasses RLS anyway)
CREATE POLICY "Allow all for anon" ON job_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON interview_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON interview_scope_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON live_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON artifacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON red_flags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON pi_screenings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON rippling_writebacks FOR ALL USING (true) WITH CHECK (true);
