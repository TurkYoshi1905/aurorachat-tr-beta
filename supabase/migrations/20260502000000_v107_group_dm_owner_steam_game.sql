-- v1.0.7 Migration: Group DM owner controls + Steam game activity + Spotify display name
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add steam_game_name column to profiles (shows current game being played)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS steam_game_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spotify_display_name TEXT DEFAULT NULL;

-- 2. Enable cascade deletes on group_dm_messages when group_dms is deleted
-- (If foreign keys exist without cascade, we recreate them)
DO $$
BEGIN
  -- Drop old FK if it exists without ON DELETE CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'group_dm_messages_group_id_fkey'
      AND table_name = 'group_dm_messages'
  ) THEN
    ALTER TABLE public.group_dm_messages
      DROP CONSTRAINT group_dm_messages_group_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_dm_messages' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.group_dm_messages
      ADD CONSTRAINT group_dm_messages_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.group_dms(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'group_dm_members_group_id_fkey'
      AND table_name = 'group_dm_members'
  ) THEN
    ALTER TABLE public.group_dm_members
      DROP CONSTRAINT group_dm_members_group_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_dm_members' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.group_dm_members
      ADD CONSTRAINT group_dm_members_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.group_dms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. RPC: delete_group_dm — owner only, cascades via FK
CREATE OR REPLACE FUNCTION public.delete_group_dm(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM group_dms
  WHERE id = p_group_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the group owner can delete the group';
  END IF;

  -- Cascade handles messages and members via FK
  DELETE FROM group_dms WHERE id = p_group_id;
END;
$$;

-- 4. RPC: remove_group_dm_member — owner only
CREATE OR REPLACE FUNCTION public.remove_group_dm_member(p_group_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM group_dms
  WHERE id = p_group_id;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the group owner can remove members';
  END IF;

  IF p_user_id = v_owner_id THEN
    RAISE EXCEPTION 'Owner cannot be removed from their own group';
  END IF;

  DELETE FROM group_dm_members
  WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

-- 5. RPC: add_group_dm_member — owner only
CREATE OR REPLACE FUNCTION public.add_group_dm_member(p_group_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_member_count INT;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM group_dms
  WHERE id = p_group_id;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the group owner can add members';
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM group_dm_members
  WHERE group_id = p_group_id;

  IF v_member_count >= 10 THEN
    RAISE EXCEPTION 'Group is at maximum capacity (10 members)';
  END IF;

  INSERT INTO group_dm_members (group_id, user_id)
  VALUES (p_group_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.delete_group_dm(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_dm_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_dm_member(UUID, UUID) TO authenticated;

-- 7. RLS: allow members to INSERT into group_dm_members (for group creation)
-- Owner can insert any member; direct insert for group creation handled by app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'group_dm_members'
      AND policyname = 'owner_can_insert_members'
  ) THEN
    CREATE POLICY owner_can_insert_members ON public.group_dm_members
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM group_dms
          WHERE id = group_id AND owner_id = auth.uid()
        )
        OR user_id = auth.uid()
      );
  END IF;
END $$;
