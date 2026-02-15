-- Minimal migration for generated question items
CREATE TABLE IF NOT EXISTS generated_question_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES assessment_blueprints(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  competency TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  format TEXT NOT NULL,
  prompt TEXT NOT NULL,
  expected_output TEXT,
  scoring_rubric JSONB NOT NULL DEFAULT '{}'::JSONB,
  red_flags JSONB NOT NULL DEFAULT '{}'::JSONB,
  anti_cheat_constraints JSONB NOT NULL DEFAULT '{}'::JSONB,
  evidence_requirements JSONB NOT NULL DEFAULT '{}'::JSONB,
  time_limit_minutes INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  validation_report JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_items_blueprint ON generated_question_items(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_question_items_track ON generated_question_items(track);
CREATE INDEX IF NOT EXISTS idx_question_items_status ON generated_question_items(status);
