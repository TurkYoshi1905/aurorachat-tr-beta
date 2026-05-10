-- v1.1.1 — Enable REPLICA IDENTITY FULL on profiles table
-- Without this, Supabase Realtime UPDATE events only include changed columns.
-- Setting FULL ensures the complete row (including status, platform, etc.) is
-- always sent in the CDC payload so clients can update member lists correctly.

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Ensure the profiles table is part of the supabase_realtime publication.
-- This is usually done automatically but we add it explicitly to be safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END$$;
