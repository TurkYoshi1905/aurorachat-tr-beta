-- v1.0.5 features migration
-- 1) server_members.order_index for per-user server reordering
-- 2) group_dms + group_dm_members + group_dm_messages
-- 3) profiles.steam_id / steam_persona / steam_profile_url

-- ============================
-- 1. Per-user server ordering
-- ============================
ALTER TABLE public.server_members
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS server_members_user_order_idx
  ON public.server_members (user_id, order_index);

-- ============================
-- 2. Steam profile fields
-- ============================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS steam_id TEXT,
  ADD COLUMN IF NOT EXISTS steam_persona TEXT,
  ADD COLUMN IF NOT EXISTS steam_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS steam_avatar_url TEXT;

-- ============================
-- 3. Group DMs
-- ============================
CREATE TABLE IF NOT EXISTS public.group_dms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.group_dm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_dms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_dm_members_group_idx ON public.group_dm_members (group_id);
CREATE INDEX IF NOT EXISTS group_dm_members_user_idx  ON public.group_dm_members (user_id);

CREATE TABLE IF NOT EXISTS public.group_dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_dms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_deleted_user_id UUID,
  content TEXT,
  attachments JSONB,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS group_dm_messages_group_inserted_idx
  ON public.group_dm_messages (group_id, inserted_at DESC);

-- ============================
-- 4. Member-count guard (max 10)
-- ============================
CREATE OR REPLACE FUNCTION public.check_group_dm_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count FROM public.group_dm_members WHERE group_id = NEW.group_id;
  IF member_count >= 10 THEN
    RAISE EXCEPTION 'Group DM max 10 members';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS group_dm_member_limit_trigger ON public.group_dm_members;
CREATE TRIGGER group_dm_member_limit_trigger
  BEFORE INSERT ON public.group_dm_members
  FOR EACH ROW EXECUTE FUNCTION public.check_group_dm_member_limit();

-- Bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.bump_group_dm_last_msg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.group_dms SET last_message_at = NEW.inserted_at, updated_at = NOW() WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bump_group_dm_last_msg_trigger ON public.group_dm_messages;
CREATE TRIGGER bump_group_dm_last_msg_trigger
  AFTER INSERT ON public.group_dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_dm_last_msg();

-- ============================
-- 5. RLS
-- ============================
ALTER TABLE public.group_dms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_dm_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_dm_messages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view their groups"      ON public.group_dms;
DROP POLICY IF EXISTS "owner can update group"             ON public.group_dms;
DROP POLICY IF EXISTS "authenticated can create group"     ON public.group_dms;
DROP POLICY IF EXISTS "owner can delete group"             ON public.group_dms;
CREATE POLICY "members can view their groups" ON public.group_dms
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.group_dm_members WHERE group_id = group_dms.id AND user_id = auth.uid()
  ));
CREATE POLICY "authenticated can create group" ON public.group_dms
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner can update group" ON public.group_dms
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owner can delete group" ON public.group_dms
  FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "members can view memberships"       ON public.group_dm_members;
DROP POLICY IF EXISTS "owner can add members"              ON public.group_dm_members;
DROP POLICY IF EXISTS "user can leave group"               ON public.group_dm_members;
DROP POLICY IF EXISTS "user can update own membership"     ON public.group_dm_members;
CREATE POLICY "members can view memberships" ON public.group_dm_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.group_dm_members gm WHERE gm.group_id = group_dm_members.group_id AND gm.user_id = auth.uid()
  ));
CREATE POLICY "owner can add members" ON public.group_dm_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_dms WHERE id = group_id AND owner_id = auth.uid())
    OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_dms WHERE id = group_id AND owner_id = auth.uid()))
  );
CREATE POLICY "user can leave group" ON public.group_dm_members
  FOR DELETE USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_dms WHERE id = group_id AND owner_id = auth.uid()
  ));
CREATE POLICY "user can update own membership" ON public.group_dm_members
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "members can view messages"  ON public.group_dm_messages;
DROP POLICY IF EXISTS "members can send messages"  ON public.group_dm_messages;
DROP POLICY IF EXISTS "sender can update message"  ON public.group_dm_messages;
DROP POLICY IF EXISTS "sender can delete message"  ON public.group_dm_messages;
CREATE POLICY "members can view messages" ON public.group_dm_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.group_dm_members WHERE group_id = group_dm_messages.group_id AND user_id = auth.uid()
  ));
CREATE POLICY "members can send messages" ON public.group_dm_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.group_dm_members WHERE group_id = group_dm_messages.group_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "sender can update message" ON public.group_dm_messages
  FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "sender can delete message" ON public.group_dm_messages
  FOR DELETE USING (sender_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_dms WHERE id = group_id AND owner_id = auth.uid()
  ));

-- ============================
-- 6. Realtime publication
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
