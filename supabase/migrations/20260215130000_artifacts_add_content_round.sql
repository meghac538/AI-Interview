-- Add missing columns to artifacts table used by artifact submission API.
-- The initial schema only had (id, session_id, artifact_type, url, metadata, created_at).
-- The application also writes content and round_number.

ALTER TABLE public.artifacts
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS round_number integer;

-- Add a jobs table used by session creation for role profiles
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  department text,
  level text,
  track text,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs_select'
  ) THEN
    CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.jobs TO authenticated, service_role;
