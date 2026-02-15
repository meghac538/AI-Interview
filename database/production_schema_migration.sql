-- =============================================================================
-- Production Schema Migration
-- Run in Supabase SQL Editor (in order)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MISSING COLUMNS on existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- assessment_blueprints: add legacy/optional fields from spec
ALTER TABLE assessment_blueprints
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS question_templates jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rubric jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS time_limits jsonb DEFAULT '{}'::jsonb;

-- job_profiles: experience_years (may already exist from earlier migration)
ALTER TABLE job_profiles
  ADD COLUMN IF NOT EXISTS experience_years_min integer,
  ADD COLUMN IF NOT EXISTS experience_years_max integer;

-- live_events: add actor column (used by all event inserts)
ALTER TABLE live_events
  ADD COLUMN IF NOT EXISTS actor text;

-- artifacts: add content + round_number as proper columns for queryability
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS round_number integer;

-- scores: add interviewer override tracking
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS recommended_followups jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS overridden_by text,
  ADD COLUMN IF NOT EXISTS override_reason text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NEW TABLE: pi_screenings
-- ─────────────────────────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_pi_screenings_candidate_id
  ON pi_screenings(candidate_id);

ALTER TABLE pi_screenings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pi_screenings' AND policyname = 'Service role full access on pi_screenings'
  ) THEN
    CREATE POLICY "Service role full access on pi_screenings"
      ON pi_screenings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NEW TABLE: agents_registry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text NOT NULL,
  provider text NOT NULL DEFAULT 'internal',
  agent_id text NOT NULL,
  supported_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  region text NOT NULL DEFAULT 'US',
  voice_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agents_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agents_registry' AND policyname = 'Service role full access on agents_registry'
  ) THEN
    CREATE POLICY "Service role full access on agents_registry"
      ON agents_registry FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NEW TABLE: models_registry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS models_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  provider text NOT NULL,
  purpose text NOT NULL,
  edgeadmin_endpoint text,
  budget_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE models_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'models_registry' AND policyname = 'Service role full access on models_registry'
  ) THEN
    CREATE POLICY "Service role full access on models_registry"
      ON models_registry FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. NEW TABLE: rippling_writebacks
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rippling_writebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rippling_writebacks_candidate_id
  ON rippling_writebacks(candidate_id);

CREATE INDEX IF NOT EXISTS idx_rippling_writebacks_status
  ON rippling_writebacks(status);

ALTER TABLE rippling_writebacks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rippling_writebacks' AND policyname = 'Service role full access on rippling_writebacks'
  ) THEN
    CREATE POLICY "Service role full access on rippling_writebacks"
      ON rippling_writebacks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
