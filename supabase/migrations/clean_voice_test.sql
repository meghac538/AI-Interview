-- CLEAN SETUP for voice-realtime testing
-- Run this in Supabase SQL Editor

-- Drop all tables in reverse dependency order (to avoid foreign key conflicts)
DROP TABLE IF EXISTS artifacts CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS live_events CASCADE;
DROP TABLE IF EXISTS interview_scope_packages CASCADE;
DROP TABLE IF EXISTS interview_sessions CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS job_profiles CASCADE;

-- Now create fresh tables

-- 1. Job Profiles (minimal)
CREATE TABLE job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  location TEXT,
  level_band TEXT,
  track TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Candidates (minimal)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rippling_candidate_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES job_profiles(job_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Interview Sessions (minimal)
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Interview Scope Packages (minimal, holds round plan)
CREATE TABLE interview_scope_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  track TEXT NOT NULL,
  round_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_set JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Live Events (for audit trail)
CREATE TABLE live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Scores (for AI assessments)
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  overall_score INTEGER,
  dimension_scores JSONB DEFAULT '{}'::jsonb,
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Artifacts (for storing transcripts, submissions)
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  artifact_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_candidates_job_id ON candidates(job_id);
CREATE INDEX idx_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_sessions_job ON interview_sessions(job_id);
CREATE INDEX idx_scope_session ON interview_scope_packages(session_id);
CREATE INDEX idx_events_session ON live_events(session_id);
CREATE INDEX idx_scores_session ON scores(session_id);
CREATE INDEX idx_artifacts_session ON artifacts(session_id);
