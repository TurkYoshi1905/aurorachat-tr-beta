
-- RLS policies for server_member_roles: INSERT, UPDATE, DELETE for server owners
CREATE POLICY "Server owners can assign member roles"
ON public.server_member_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.id = server_member_roles.member_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Server owners can update member roles"
ON public.server_member_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.id = server_member_roles.member_id
      AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Server owners can delete member roles"
ON public.server_member_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.id = server_member_roles.member_id
      AND s.owner_id = auth.uid()
  )
);
