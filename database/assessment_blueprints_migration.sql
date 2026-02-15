-- Minimal migration for assessment_blueprints
CREATE TABLE IF NOT EXISTS assessment_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track TEXT NOT NULL,
  competency TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  format TEXT NOT NULL,
  scoring_rubric JSONB NOT NULL DEFAULT '{}'::JSONB,
  red_flags JSONB NOT NULL DEFAULT '{}'::JSONB,
  anti_cheat_constraints JSONB NOT NULL DEFAULT '{}'::JSONB,
  evidence_requirements JSONB NOT NULL DEFAULT '{}'::JSONB,
  time_limit_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_track ON assessment_blueprints(track);
CREATE INDEX IF NOT EXISTS idx_blueprints_competency ON assessment_blueprints(competency);
CREATE INDEX IF NOT EXISTS idx_blueprints_difficulty ON assessment_blueprints(difficulty);
