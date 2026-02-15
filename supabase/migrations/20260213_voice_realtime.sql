-- Voice Realtime Feature - Database Schema
-- Created: 2026-02-13
-- Purpose: Tables for voice-realtime interview rounds with OpenAI Realtime API

-- 1. Personas table - AI character profiles for role-play scenarios
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  company_context TEXT NOT NULL,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  communication_style TEXT NOT NULL,
  objection_patterns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Scenarios table - Business context for role-play sessions
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  industry TEXT NOT NULL,
  company_size TEXT NOT NULL,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  budget_range TEXT NOT NULL,
  decision_timeline TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Voice Commands table - Interviewer control relay (difficulty dial, curveballs)
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI Assessments table - Silent observations during conversation
CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation TEXT NOT NULL,
  dimension TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'concern', 'red_flag')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_commands(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_session ON ai_assessments(session_id, round_number, created_at DESC);

-- Row Level Security (RLS) - Optional, adjust based on your auth setup
-- ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_assessments ENABLE ROW LEVEL SECURITY;

-- Grant access (adjust based on your role setup)
-- GRANT ALL ON personas TO authenticated;
-- GRANT ALL ON scenarios TO authenticated;
-- GRANT ALL ON voice_commands TO authenticated;
-- GRANT ALL ON ai_assessments TO authenticated;
