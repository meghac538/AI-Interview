-- Add experience_years columns to job_profiles for granular difficulty computation
ALTER TABLE job_profiles ADD COLUMN IF NOT EXISTS experience_years_min integer;
ALTER TABLE job_profiles ADD COLUMN IF NOT EXISTS experience_years_max integer;
