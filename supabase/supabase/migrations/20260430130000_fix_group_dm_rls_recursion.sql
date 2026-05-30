-- v1.0.5 hotfix: Group DM RLS infinite recursion
--
-- The previous policy on group_dm_members did `EXISTS (SELECT 1 FROM group_dm_members ...)`
-- which re-triggers the same RLS check on group_dm_members → infinite recursion.
-- group_dms and group_dm_messages policies also query group_dm_members and were dragged
-- into the same recursive evaluation.
--
-- Fix: introduce a SECURITY DEFINER helper that bypasses RLS, then rewrite the
-- policies to use it. The helper is owned by postgres (so it runs with elevated
-- privileges) and is marked STABLE so PostgreSQL can cache its result per query.

-- ============================
-- 1. Helper functions (SECURITY DEFINER → bypass RLS, no recursion)
-- ============================
CREATE OR REPLACE FUNCTION public.is_group_dm_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_dm_members
    WHERE group_id = _group_id
      AND user_id  = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_dm_owner(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_dms
    WHERE id = _group_id
      AND owner_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_dm_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_group_dm_owner(UUID, UUID)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_dm_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_dm_owner(UUID, UUID)  TO authenticated;

-- ============================
-- 2. Drop old (recursive) policies
-- ============================
DROP POLICY IF EXISTS "members can view their groups"   ON public.group_dms;
DROP POLICY IF EXISTS "owner can update group"          ON public.group_dms;
DROP POLICY IF EXISTS "authenticated can create group"  ON public.group_dms;
DROP POLICY IF EXISTS "owner can delete group"          ON public.group_dms;

DROP POLICY IF EXISTS "members can view memberships"    ON public.group_dm_members;
DROP POLICY IF EXISTS "owner can add members"           ON public.group_dm_members;
DROP POLICY IF EXISTS "user can leave group"            ON public.group_dm_members;
DROP POLICY IF EXISTS "user can update own membership"  ON public.group_dm_members;

DROP POLICY IF EXISTS "members can view messages"       ON public.group_dm_messages;
DROP POLICY IF EXISTS "members can send messages"       ON public.group_dm_messages;
DROP POLICY IF EXISTS "sender can update message"       ON public.group_dm_messages;
DROP POLICY IF EXISTS "sender can delete message"       ON public.group_dm_messages;

-- ============================
-- 3. group_dms policies
-- ============================
CREATE POLICY "members can view their groups" ON public.group_dms
  FOR SELECT
  USING ( public.is_group_dm_member(id, auth.uid()) );

CREATE POLICY "authenticated can create group" ON public.group_dms
  FOR INSERT
  WITH CHECK ( auth.uid() = owner_id );

CREATE POLICY "owner can update group" ON public.group_dms
  FOR UPDATE
  USING ( auth.uid() = owner_id );

CREATE POLICY "owner can delete group" ON public.group_dms
  FOR DELETE
  USING ( auth.uid() = owner_id );

-- ============================
-- 4. group_dm_members policies (no recursion)
-- ============================
-- A user can see all memberships of any group they themselves belong to.
-- The is_group_dm_member() helper bypasses RLS so there's no recursion.
CREATE POLICY "members can view memberships" ON public.group_dm_members
  FOR SELECT
  USING ( public.is_group_dm_member(group_id, auth.uid()) );

-- Insert: owner can add anyone, OR a user can add themselves to a group they own.
CREATE POLICY "owner can add members" ON public.group_dm_members
  FOR INSERT
  WITH CHECK ( public.is_group_dm_owner(group_id, auth.uid()) );

-- Delete: a user can leave on their own, OR the owner can kick them.
CREATE POLICY "user can leave group" ON public.group_dm_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_group_dm_owner(group_id, auth.uid())
  );

-- Update: a user can edit their own membership row (e.g. hide flag).
CREATE POLICY "user can update own membership" ON public.group_dm_members
  FOR UPDATE
  USING ( user_id = auth.uid() );

-- ============================
-- 5. group_dm_messages policies
-- ============================
CREATE POLICY "members can view messages" ON public.group_dm_messages
  FOR SELECT
  USING ( public.is_group_dm_member(group_id, auth.uid()) );

CREATE POLICY "members can send messages" ON public.group_dm_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_group_dm_member(group_id, auth.uid())
  );

CREATE POLICY "sender can update message" ON public.group_dm_messages
  FOR UPDATE
  USING ( sender_id = auth.uid() );

CREATE POLICY "sender can delete message" ON public.group_dm_messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
    OR public.is_group_dm_owner(group_id, auth.uid())
  );
