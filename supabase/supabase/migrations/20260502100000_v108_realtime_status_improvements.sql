-- v1.0.8: Realtime status improvements for group DM members
-- Ensure profiles status column is included in realtime publication

-- Enable realtime on profiles if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Enable realtime on group_dm_members if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_dm_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_members;
  END IF;
END $$;

-- Ensure status column has a default value in profiles
ALTER TABLE public.profiles
  ALTER COLUMN status SET DEFAULT 'offline';

-- Index for faster status queries on group members
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
