-- Allow unauthenticated (anon) users to read server invites by code
-- This is required so the invite page can display server info before login

DROP POLICY IF EXISTS "Invites viewable by code" ON public.server_invites;
CREATE POLICY "Invites viewable by code" ON public.server_invites
  FOR SELECT TO anon, authenticated USING (true);

-- Allow anon users to view servers (needed to show server name/icon on invite page)
DROP POLICY IF EXISTS "Servers viewable by invite code" ON public.servers;
CREATE POLICY "Servers viewable by invite code" ON public.servers
  FOR SELECT TO anon, authenticated USING (true);

-- Allow anon users to count server members (member count on invite page)
DROP POLICY IF EXISTS "Anyone can count server members" ON public.server_members;
CREATE POLICY "Anyone can count server members" ON public.server_members
  FOR SELECT TO anon USING (true);
