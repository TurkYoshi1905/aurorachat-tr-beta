-- v1.1.1 — manage_bots permission & server_bots RLS enforcement
-- The manage_bots permission is stored as JSONB in server_roles.permissions.
-- This migration adds a helper RPC and tightens server_bots INSERT RLS so that
-- only server owners and members with administrator / manage_server / manage_bots
-- permission can add a bot to a server.

-- Helper: check if a user has bot-management permission on a server
CREATE OR REPLACE FUNCTION public.user_can_manage_bots(p_user_id uuid, p_server_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    -- User is the server owner
    SELECT 1 FROM public.servers s
    WHERE s.id = p_server_id AND s.owner_id = p_user_id
  ) OR EXISTS (
    -- User has a role with administrator, manage_server, or manage_bots permission
    SELECT 1
    FROM public.server_members sm
    JOIN public.server_member_roles smr ON smr.member_id = sm.id
    JOIN public.server_roles sr ON sr.id = smr.role_id
    WHERE sm.server_id = p_server_id
      AND sm.user_id = p_user_id
      AND (
        (sr.permissions->>'administrator')::boolean IS TRUE
        OR (sr.permissions->>'manage_server')::boolean IS TRUE
        OR (sr.permissions->>'manage_bots')::boolean IS TRUE
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_bots(uuid, uuid) TO authenticated;

-- Drop existing permissive INSERT policy on server_bots if any
DO $$
BEGIN
  DROP POLICY IF EXISTS "server_bots_insert" ON public.server_bots;
  DROP POLICY IF EXISTS "Allow insert server_bots" ON public.server_bots;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- New INSERT policy: must have permission
CREATE POLICY "server_bots_insert_permitted"
  ON public.server_bots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_can_manage_bots(auth.uid(), server_id)
  );

-- DELETE policy: same permission required (or bot owner)
DO $$
BEGIN
  DROP POLICY IF EXISTS "server_bots_delete" ON public.server_bots;
  DROP POLICY IF EXISTS "Allow delete server_bots" ON public.server_bots;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

CREATE POLICY "server_bots_delete_permitted"
  ON public.server_bots
  FOR DELETE
  TO authenticated
  USING (
    public.user_can_manage_bots(auth.uid(), server_id)
    OR EXISTS (
      SELECT 1 FROM public.bots b WHERE b.id = bot_id AND b.owner_id = auth.uid()
    )
  );
