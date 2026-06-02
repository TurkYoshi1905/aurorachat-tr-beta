
-- Fix: Allow users with manage_channels or administrator role permission
-- to create, update, and delete channels (not just server owners).

-- Helper function: check if a user has a specific permission via their assigned roles
CREATE OR REPLACE FUNCTION public.has_server_permission(_user_id UUID, _server_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM server_member_roles smr
    JOIN server_roles sr ON sr.id = smr.role_id
    JOIN server_members sm ON sm.id = smr.member_id
    WHERE sm.user_id = _user_id
      AND sm.server_id = _server_id
      AND (
        (sr.permissions->>_permission)::boolean = true
        OR (sr.permissions->>'administrator')::boolean = true
      )
  );
$$;

-- Drop old channel management policies (owner-only)
DROP POLICY IF EXISTS "Server owners can manage channels" ON public.channels;
DROP POLICY IF EXISTS "Server owners can update channels" ON public.channels;
DROP POLICY IF EXISTS "Server owners can delete channels" ON public.channels;

-- New policies: allow owner OR users with manage_channels/administrator permission
CREATE POLICY "Owners and managers can create channels" ON public.channels
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
    OR public.has_server_permission(auth.uid(), server_id, 'manage_channels')
  );

CREATE POLICY "Owners and managers can update channels" ON public.channels
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
    OR public.has_server_permission(auth.uid(), server_id, 'manage_channels')
  );

CREATE POLICY "Owners and managers can delete channels" ON public.channels
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
    OR public.has_server_permission(auth.uid(), server_id, 'manage_channels')
  );

-- Also fix channel_categories: allow manage_channels permission holders
DROP POLICY IF EXISTS "Server owners can manage categories" ON public.channel_categories;

CREATE POLICY "Owners and managers can manage categories" ON public.channel_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM servers WHERE id = channel_categories.server_id AND owner_id = auth.uid())
    OR public.has_server_permission(auth.uid(), channel_categories.server_id, 'manage_channels')
  );
