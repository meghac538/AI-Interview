-- Update Personas Schema - Add missing columns
-- Created: 2026-02-14
-- Purpose: Add blueprint, difficulty, and other missing columns to personas table

-- Add missing columns
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS blueprint TEXT NOT NULL DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS difficulty INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prompt_template TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS first_message_template TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraints after columns are added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personas_blueprint_check'
  ) THEN
    ALTER TABLE personas ADD CONSTRAINT personas_blueprint_check
      CHECK (blueprint IN ('sales', 'agentic_eng', 'fullstack', 'marketing', 'implementation', 'HR', 'security'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personas_difficulty_check'
  ) THEN
    ALTER TABLE personas ADD CONSTRAINT personas_difficulty_check
      CHECK (difficulty BETWEEN 1 AND 5);
  END IF;
END $$;

-- Trigger function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_personas_blueprint_difficulty
  ON personas(blueprint, difficulty)
  WHERE is_active = true;
