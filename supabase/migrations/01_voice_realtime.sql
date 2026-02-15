-- Voice Realtime Feature - Consolidated Migration
-- Created: 2026-02-14

-- ============================================
-- PERSONAS - Enhanced with blueprint tagging
-- ============================================

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  blueprint TEXT NOT NULL CHECK (blueprint IN ('sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  company_context TEXT NOT NULL,
  personality_traits TEXT[] NOT NULL DEFAULT '{}',
  communication_style TEXT NOT NULL,
  objection_patterns TEXT[] NOT NULL DEFAULT '{}',
  prompt_template TEXT NOT NULL,
  first_message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for personas table
CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SCENARIOS
-- ============================================

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

-- ============================================
-- VOICE COMMANDS
-- ============================================

CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI ASSESSMENTS
-- ============================================

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

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add persona/scenario references to interview_scope_packages
ALTER TABLE interview_scope_packages
  ADD COLUMN IF NOT EXISTS selected_persona_id UUID REFERENCES personas(id),
  ADD COLUMN IF NOT EXISTS selected_scenario_id UUID REFERENCES scenarios(id),
  ADD COLUMN IF NOT EXISTS voice_agent_id TEXT;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_personas_blueprint_difficulty
  ON personas(blueprint, difficulty)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_voice_commands_session
  ON voice_commands(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_assessments_session
  ON ai_assessments(session_id, round_number, created_at DESC);

-- Foreign key indexes for interview_scope_packages
CREATE INDEX IF NOT EXISTS idx_scope_packages_persona
  ON interview_scope_packages(selected_persona_id);

CREATE INDEX IF NOT EXISTS idx_scope_packages_scenario
  ON interview_scope_packages(selected_scenario_id);
