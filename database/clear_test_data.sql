-- Clear all test data from all tables
-- Uses TRUNCATE CASCADE to handle foreign key dependencies automatically
-- Run in Supabase SQL Editor

TRUNCATE TABLE
  scores,
  live_events,
  artifacts,
  interview_scope_packages,
  interview_sessions,
  generated_question_items,
  assessment_blueprints,
  candidates,
  job_profiles
CASCADE;

-- Also clear new tables if they exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pi_screenings') THEN
    TRUNCATE TABLE pi_screenings CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rippling_writebacks') THEN
    TRUNCATE TABLE rippling_writebacks CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents_registry') THEN
    TRUNCATE TABLE agents_registry CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'models_registry') THEN
    TRUNCATE TABLE models_registry CASCADE;
  END IF;
END $$;
