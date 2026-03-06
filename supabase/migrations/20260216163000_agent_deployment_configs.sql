-- Agent deployment configuration + run logs for interviewer-triggered webhooks/APIs.

ALTER TABLE public.webhook_configs
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS role_family text,
  ADD COLUMN IF NOT EXISTS http_method text NOT NULL DEFAULT 'POST',
  ADD COLUMN IF NOT EXISTS request_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timeout_ms integer NOT NULL DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_configs_role_family ON public.webhook_configs(role_family);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active ON public.webhook_configs(is_active);

CREATE TABLE IF NOT EXISTS public.session_agent_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  webhook_config_id uuid NOT NULL REFERENCES public.webhook_configs(id) ON DELETE RESTRICT,
  deployed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_name text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'success', 'failed', 'timeout')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status integer,
  response_body jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_agent_deployments_session_created
  ON public.session_agent_deployments(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_agent_deployments_status
  ON public.session_agent_deployments(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_session_agent_deployment(
  p_session_id uuid,
  p_webhook_config_id uuid,
  p_deployed_by uuid,
  p_deployment_name text,
  p_request_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.session_agent_deployments (
    session_id,
    webhook_config_id,
    deployed_by,
    deployment_name,
    status,
    request_payload
  )
  VALUES (
    p_session_id,
    p_webhook_config_id,
    p_deployed_by,
    p_deployment_name,
    'queued',
    COALESCE(p_request_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_session_agent_deployment(uuid, uuid, uuid, text, jsonb)
  TO authenticated, service_role;

ALTER TABLE public.session_agent_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_agent_deployments_select ON public.session_agent_deployments;
DROP POLICY IF EXISTS session_agent_deployments_insert ON public.session_agent_deployments;
DROP POLICY IF EXISTS session_agent_deployments_update ON public.session_agent_deployments;

CREATE POLICY session_agent_deployments_select
  ON public.session_agent_deployments
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'hiring_lead', 'recruiter'));

CREATE POLICY session_agent_deployments_insert
  ON public.session_agent_deployments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'hiring_lead', 'recruiter'));

CREATE POLICY session_agent_deployments_update
  ON public.session_agent_deployments
  FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'hiring_lead', 'recruiter'))
  WITH CHECK (public.get_user_role() IN ('admin', 'hiring_lead', 'recruiter'));

GRANT ALL ON TABLE public.session_agent_deployments TO authenticated, service_role;
