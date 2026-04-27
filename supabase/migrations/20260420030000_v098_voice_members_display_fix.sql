-- v0.9.8 Voice Members Display Fix
-- 1. Extend stale cleanup to 5 minutes (heartbeat is 30s, 2 min was too aggressive)
-- 2. Ensure all required columns exist on voice_channel_members
-- 3. Re-apply RLS so any authenticated user can see who is in a voice channel
-- 4. Ensure realtime publication and REPLICA IDENTITY FULL

-- ── 1. Add missing columns safely ─────────────────────────────────────────────
ALTER TABLE public.voice_channel_members
  ADD COLUMN IF NOT EXISTS camera_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS screen_sharing  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Extended stale-member cleanup (5 minutes instead of 2) ─────────────────
CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.voice_channel_members
  WHERE joined_at < now() - interval '5 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_voice_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_members() TO authenticated;

-- ── 3. RLS — any authenticated user can read voice members ────────────────────
ALTER TABLE public.voice_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view voice members" ON public.voice_channel_members;
CREATE POLICY "Anyone authenticated can view voice members"
  ON public.voice_channel_members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can upsert own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can upsert own voice member row"
  ON public.voice_channel_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can update own voice member row"
  ON public.voice_channel_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can delete own voice member row"
  ON public.voice_channel_members FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. Realtime publication & full row data on DELETE ─────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_channel_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

ALTER TABLE public.voice_channel_members REPLICA IDENTITY FULL;

-- ── 5. Index for fast server+channel lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_voice_channel_members_server_channel
  ON public.voice_channel_members(server_id, channel_id, joined_at);
