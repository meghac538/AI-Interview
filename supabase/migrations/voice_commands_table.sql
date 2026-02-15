-- Add voice_commands table for interviewer control relay

CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL CHECK (command_type IN ('difficulty_change', 'curveball_inject')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by session
CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_commands(session_id);

-- Index for real-time subscriptions (most recent first)
CREATE INDEX IF NOT EXISTS idx_voice_commands_created ON voice_commands(created_at DESC);
