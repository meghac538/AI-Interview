-- AI Assessments table for silent observer during voice calls

CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observation TEXT NOT NULL,
  dimension TEXT NOT NULL, -- e.g., 'rapport', 'discovery', 'objection_handling'
  severity TEXT NOT NULL CHECK (severity IN ('info', 'concern', 'red_flag')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_ai_assessments_session ON ai_assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_severity ON ai_assessments(session_id, severity);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_created ON ai_assessments(created_at DESC);
