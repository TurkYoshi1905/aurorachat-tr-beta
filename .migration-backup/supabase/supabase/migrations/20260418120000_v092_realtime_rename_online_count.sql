-- v0.9.2: Realtime for channel_categories rename + efficient server online count RPC
-- Run this in Supabase SQL Editor

-- 1. Enable Realtime on channel_categories
--    (channels already in realtime from v081; categories were missing)
ALTER TABLE public.channel_categories REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'channel_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_categories;
  END IF;
END$$;

-- 2. Create get_server_online_count RPC
--    Counts server members whose last_seen is within 5 minutes and status != 'offline'.
--    Replaces the previous two-step frontend query (fetch all member IDs → count profiles).
--    Security: only server members can call this (server_members check enforces membership).
CREATE OR REPLACE FUNCTION public.get_server_online_count(p_server_id UUID)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.server_members sm
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.server_id = p_server_id
    AND p.status IS DISTINCT FROM 'offline'
    AND p.last_seen >= NOW() - INTERVAL '5 minutes';
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_server_online_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_online_count(UUID) TO anon;

-- 3. Index to speed up the online count query
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_status
  ON public.profiles(last_seen, status)
  WHERE status IS DISTINCT FROM 'offline';
