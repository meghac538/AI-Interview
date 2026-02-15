-- Create the pi_screenings table
-- This stores pre-interview screening results that inform round difficulty and content

CREATE TABLE IF NOT EXISTS pi_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  completed_at timestamptz,
  resume_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb,
  audio_url text,
  pi_score_overall numeric,
  dimension_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  pass_fail boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast candidate lookup
CREATE INDEX IF NOT EXISTS idx_pi_screenings_candidate_id ON pi_screenings(candidate_id);

-- Enable RLS
ALTER TABLE pi_screenings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on pi_screenings"
  ON pi_screenings
  FOR ALL
  USING (true)
  WITH CHECK (true);
