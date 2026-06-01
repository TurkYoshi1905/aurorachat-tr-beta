-- v1.0.5 hotfix #2: Group DM owner visibility + INSERT RETURNING
--
-- Problem 1: group_dms INSERT fails with "new row violates row-level security policy"
--   The client does `.insert(...).select('id').single()`. Postgres applies
--   WITH CHECK to the new row (passes), then applies SELECT USING for RETURNING.
--   Old SELECT policy only allowed members → at insert time there are no members
--   yet → SELECT returns 0 rows → PostgREST surfaces this as an RLS violation.
--   Fix: also allow the owner to SELECT their own group.
--
-- Problem 2: Owner can't see members of their own group.
--   The group_dm_members SELECT policy only checks is_group_dm_member.
--   Add an OR clause for the owner.
--
-- Problem 3: A user couldn't see their own membership row right after insert.
--   Add `user_id = auth.uid()` so each user can always see their own row.
--
-- Problem 4 (defensive): allow the owner to send messages even if they
--   somehow aren't in group_dm_members (shouldn't happen in normal flow,
--   but keeps the owner unblocked).

-- ============================
-- group_dms : SELECT — owner OR member
-- ============================
DROP POLICY IF EXISTS "members can view their groups" ON public.group_dms;
CREATE POLICY "members can view their groups" ON public.group_dms
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR public.is_group_dm_member(id, auth.uid())
  );

-- ============================
-- group_dm_members : SELECT — self OR co-member OR owner
-- ============================
DROP POLICY IF EXISTS "members can view memberships" ON public.group_dm_members;
CREATE POLICY "members can view memberships" ON public.group_dm_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_group_dm_member(group_id, auth.uid())
    OR public.is_group_dm_owner(group_id, auth.uid())
  );

-- ============================
-- group_dm_messages : SELECT — member OR owner
-- ============================
DROP POLICY IF EXISTS "members can view messages" ON public.group_dm_messages;
CREATE POLICY "members can view messages" ON public.group_dm_messages
  FOR SELECT
  USING (
    public.is_group_dm_member(group_id, auth.uid())
    OR public.is_group_dm_owner(group_id, auth.uid())
  );

-- ============================
-- group_dm_messages : INSERT — sender must be member OR owner
-- ============================
DROP POLICY IF EXISTS "members can send messages" ON public.group_dm_messages;
CREATE POLICY "members can send messages" ON public.group_dm_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_group_dm_member(group_id, auth.uid())
      OR public.is_group_dm_owner(group_id, auth.uid())
    )
  );
