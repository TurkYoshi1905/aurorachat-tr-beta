-- v1.1.1: Fix reports realtime - set REPLICA IDENTITY FULL so UPDATE events fire with filter
ALTER TABLE public.message_reports REPLICA IDENTITY FULL;

-- Ensure message_reports is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
  END IF;
END $$;
