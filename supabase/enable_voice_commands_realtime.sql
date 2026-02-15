-- Enable Realtime for voice_commands table
-- This allows difficulty dial and curveball commands to relay in real-time

ALTER PUBLICATION supabase_realtime ADD TABLE voice_commands;

-- Verify it's enabled
SELECT
  tablename,
  CASE
    WHEN tablename = ANY(
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
    ) THEN 'ENABLED ✅'
    ELSE 'DISABLED ❌'
  END as realtime_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'voice_commands';
