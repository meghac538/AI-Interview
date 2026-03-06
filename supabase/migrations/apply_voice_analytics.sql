-- Voice Analytics — Idempotent apply script
-- Creates tables + indexes + enables realtime for the voice coaching pipeline
-- Safe to run multiple times (all statements use IF NOT EXISTS / conditional logic)

-- ============================================
-- TRANSCRIPT STORAGE
-- ============================================

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYSIS RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS voice_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('say_meter', 'suggestion')),

  -- Say Meter fields
  meter_score INTEGER CHECK (meter_score BETWEEN 0 AND 100),
  meter_factors JSONB DEFAULT '{}',
  meter_reasoning TEXT,

  -- Suggestion fields
  suggestion_text TEXT,
  suggestion_category TEXT CHECK (suggestion_category IN ('context_injection', 'curveball', 'followup_question')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Metadata
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_transcripts_session
  ON voice_transcripts(session_id, round_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_analysis_session
  ON voice_analysis(session_id, analysis_type, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_analysis_undismissed
  ON voice_analysis(session_id, dismissed)
  WHERE dismissed = false;

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- The useVoiceAnalysis hook subscribes to INSERT/UPDATE on voice_analysis
-- so it must be in the supabase_realtime publication.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_analysis'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE voice_analysis;
  END IF;
END $$;
