-- v0.9.6 Voice: stale member cleanup function + auto-delete trigger

-- 1. Function: clean up voice_channel_members entries older than 2 minutes
--    Call this via RPC when fetching voice members to auto-remove ghost sessions
CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.voice_channel_members
  WHERE joined_at < NOW() - INTERVAL '2 minutes';
END;
$$;

-- Grant execution to authenticated users so frontend can call it
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_members() TO authenticated;

-- 2. Ensure voice_channel_members is in the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_channel_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- 3. Ensure REPLICA IDENTITY FULL so DELETE events carry full row data
ALTER TABLE public.voice_channel_members REPLICA IDENTITY FULL;
