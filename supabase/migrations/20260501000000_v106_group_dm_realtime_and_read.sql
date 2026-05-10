-- v1.0.6 migration
-- 1) REPLICA IDENTITY FULL on group DM tables so Supabase Realtime carries
--    the full old/new row for UPDATE and DELETE events (edit & delete in GroupDMChatArea)
-- 2) last_read_at column on group_dm_members for per-user unread tracking
-- 3) owner INSERT-self policy fix (owner can always insert their own member row)
-- 4) group_dm_messages: owner can also UPDATE/DELETE any message

-- ============================
-- 1. Replica identity (Realtime UPDATE/DELETE support)
-- ============================
ALTER TABLE public.group_dms         REPLICA IDENTITY FULL;
ALTER TABLE public.group_dm_members  REPLICA IDENTITY FULL;
ALTER TABLE public.group_dm_messages REPLICA IDENTITY FULL;

-- ============================
-- 2. last_read_at for unread badge tracking
-- ============================
ALTER TABLE public.group_dm_members
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- ============================
-- 3. owner can add themselves as a member
--    (previous policy required is_group_dm_owner, which is correct —
--     but also allow a user to insert their own row if they're the owner)
-- ============================
DROP POLICY IF EXISTS "owner can add members" ON public.group_dm_members;
CREATE POLICY "owner can add members" ON public.group_dm_members
  FOR INSERT
  WITH CHECK (
    public.is_group_dm_owner(group_id, auth.uid())
    OR (user_id = auth.uid() AND public.is_group_dm_owner(group_id, auth.uid()))
  );

-- ============================
-- 4. owner can update ANY message in their group (e.g. moderation)
-- ============================
DROP POLICY IF EXISTS "sender can update message" ON public.group_dm_messages;
CREATE POLICY "sender can update message" ON public.group_dm_messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR public.is_group_dm_owner(group_id, auth.uid())
  );

-- ============================
-- 5. Ensure Realtime publication (idempotent — no-op if already added)
-- ============================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================
-- 6. Helper: mark group as read (updates last_read_at for calling user)
-- ============================
CREATE OR REPLACE FUNCTION public.mark_group_dm_read(_group_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.group_dm_members
  SET last_read_at = NOW()
  WHERE group_id = _group_id
    AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mark_group_dm_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_group_dm_read(UUID) TO authenticated;
