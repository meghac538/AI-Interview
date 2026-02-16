-- Add resume_storage_path column to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_storage_path TEXT;
