-- Base Schema for AI Interview Platform
-- Run this FIRST in a new Supabase project

-- Job Profiles
CREATE TABLE IF NOT EXISTS job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  level_band TEXT NOT NULL CHECK (level_band IN ('junior', 'mid', 'senior')),
  track TEXT NOT NULL CHECK (track IN ('sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security')),
  role_success_criteria TEXT NOT NULL,
  must_have_flags TEXT[] NOT NULL DEFAULT '{}',
  disqualifiers TEXT[] NOT NULL DEFAULT '{}',
  gating_thresholds JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rippling_candidate_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  job_id TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'pi_scheduled', 'pi_passed', 'live_scheduled', 'live_completed', 'rejected', 'advanced')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview Sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES job_profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'live',
  meeting_link TEXT,
  scheduled_at TIMESTAMPTZ,
  interviewer_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'completed', 'aborted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview Scope Packages (contains round_plan JSONB)
CREATE TABLE IF NOT EXISTS interview_scope_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  track TEXT NOT NULL,
  round_plan JSONB NOT NULL DEFAULT '[]',
  question_set JSONB NOT NULL DEFAULT '{}',
  simulation_payloads JSONB NOT NULL DEFAULT '{}',
  rubric_version TEXT NOT NULL,
  models_used TEXT[] NOT NULL DEFAULT '{}',
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  overall_score NUMERIC NOT NULL,
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  red_flags JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL,
  evidence_quotes JSONB NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL CHECK (recommendation IN ('proceed', 'caution', 'stop')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live Events (Audit Log)
CREATE TABLE IF NOT EXISTS live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scope_packages_session ON interview_scope_packages(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_live_events_session ON live_events(session_id, created_at DESC);

-- Enable Row Level Security (optional - adjust based on your auth)
-- ALTER TABLE job_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interview_scope_packages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
