-- Fix 1: Add server_members to realtime publication so JOIN/LEAVE events are broadcast
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
  END IF;
END $$;

-- Helper: check if a user has a specific permission key via the custom roles system
CREATE OR REPLACE FUNCTION public.user_has_server_permission(p_user_id uuid, p_server_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    JOIN public.server_member_roles smr ON smr.member_id = sm.id
    JOIN public.server_roles sr ON sr.id = smr.role_id
    WHERE sm.user_id = p_user_id
      AND sm.server_id = p_server_id
      AND (
        (sr.permissions->>'administrator')::boolean = true
        OR (sr.permissions->>p_permission)::boolean = true
      )
  );
$$;

-- Helper: check if a user is the server owner or has an elevated role
CREATE OR REPLACE FUNCTION public.user_can_manage_member(p_user_id uuid, p_server_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    -- server owner
    EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_user_id)
    OR
    -- old-style admin/owner role in server_members
    EXISTS (SELECT 1 FROM public.server_members WHERE server_id = p_server_id AND user_id = p_user_id AND role IN ('owner', 'admin'))
    OR
    -- new role system: administrator or kick_members permission
    public.user_has_server_permission(p_user_id, p_server_id, 'kick_members')
  );
$$;

-- Fix 2: Allow server owners/admins to kick (delete) other members via RLS
DROP POLICY IF EXISTS "Admins and owners can kick members" ON public.server_members;
CREATE POLICY "Admins and owners can kick members" ON public.server_members
  FOR DELETE TO authenticated
  USING (
    public.user_can_manage_member(auth.uid(), server_members.server_id)
    AND
    -- Cannot kick the server owner
    NOT EXISTS (SELECT 1 FROM public.servers WHERE id = server_members.server_id AND owner_id = server_members.user_id)
    AND
    -- Cannot kick yourself via this policy (existing "leave" policy handles that)
    server_members.user_id != auth.uid()
  );

-- Fix 3: Allow server admins (not only owners) to manage bans
DROP POLICY IF EXISTS "Server owners can manage bans" ON public.server_bans;
DROP POLICY IF EXISTS "Admins and owners can manage bans" ON public.server_bans;
CREATE POLICY "Admins and owners can manage bans" ON public.server_bans
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_bans.server_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.server_members WHERE server_id = server_bans.server_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR
    public.user_has_server_permission(auth.uid(), server_bans.server_id, 'ban_members')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_bans.server_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.server_members WHERE server_id = server_bans.server_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR
    public.user_has_server_permission(auth.uid(), server_bans.server_id, 'ban_members')
  );
