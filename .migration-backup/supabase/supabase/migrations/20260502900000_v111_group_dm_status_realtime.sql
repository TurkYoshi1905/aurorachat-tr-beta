-- v1.1.1 Group DM status realtime fix
-- Ensures profiles table has REPLICA IDENTITY FULL and is in realtime publication
-- (idempotent safety re-run)

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END$$;

-- Ensure group_dm_members is in realtime publication so INSERT/DELETE fires
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_dm_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_members;
  END IF;
END$$;

ALTER TABLE public.group_dm_members REPLICA IDENTITY FULL;
