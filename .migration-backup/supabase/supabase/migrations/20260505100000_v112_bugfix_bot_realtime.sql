-- v1.1.2 Bugfix: Bot member list realtime, server_bots RLS for members query
-- Run this in Supabase SQL Editor

-- ── 1. server_bots → REPLICA IDENTITY FULL (realtime DELETE events carry old row) ──
ALTER TABLE public.server_bots REPLICA IDENTITY FULL;

-- ── 2. Ensure server_bots is in realtime publication ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_bots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_bots;
  END IF;
END $$;

-- ── 3. bots SELECT policy: allow any authenticated user to read bots ───────────────
-- This is needed so the botCommands.ts query (.from('bots').select(...).in('id', botIds)) works
DROP POLICY IF EXISTS "Anyone can view bots" ON public.bots;
CREATE POLICY "Anyone can view bots" ON public.bots
  FOR SELECT USING (true);

-- ── 4. server_bots SELECT policy: server members can read server_bots ─────────────
DROP POLICY IF EXISTS "Members and bot owners can view server bots" ON public.server_bots;
CREATE POLICY "Members and bot owners can view server bots" ON public.server_bots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = server_bots.server_id AND sm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_bots.server_id AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bots b
      WHERE b.id = server_bots.bot_id AND b.owner_id = auth.uid()
    )
  );

-- ── 5. get_server_members_full: include bots from server_bots ─────────────────────
-- (Re-creates the RPC to ensure bots appear in member list)
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(sub.row_data)
    FROM (
      -- Regular members
      SELECT
        jsonb_build_object(
          'member_id',        sm.id::text,
          'user_id',          sm.user_id::text,
          'username',         p.username,
          'display_name',     p.display_name,
          'avatar_url',       p.avatar_url,
          'status',           COALESCE(p.status, 'offline'),
          'bio',              p.bio,
          'banner_color',     p.banner_color,
          'is_premium',       COALESCE(p.is_premium, false),
          'has_premium_badge',COALESCE(p.has_premium_badge, false),
          'has_basic_badge',  COALESCE(p.has_basic_badge, false),
          'is_bot',           false,
          'last_seen',        p.last_seen,
          'platform',         p.platform,
          'roles', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',          sr.id::text,
                'name',        sr.name,
                'color',       sr.color,
                'position',    sr.position,
                'permissions', sr.permissions
              )
              ORDER BY sr.position DESC
            )
            FROM server_member_roles smr
            JOIN server_roles sr ON sr.id = smr.role_id
            WHERE smr.member_id = sm.id
          ), '[]'::jsonb)
        ) AS row_data
      FROM server_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.server_id = p_server_id

      UNION ALL

      -- Bot members
      SELECT
        jsonb_build_object(
          'member_id',        sb.id::text,
          'user_id',          b.id::text,
          'username',         b.username,
          'display_name',     b.name,
          'avatar_url',       b.avatar_url,
          'status',           'online',
          'bio',              b.description,
          'banner_color',     null,
          'is_premium',       false,
          'has_premium_badge',false,
          'has_basic_badge',  false,
          'is_bot',           true,
          'last_seen',        null,
          'platform',         null,
          'roles', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',          sr.id::text,
                'name',        sr.name,
                'color',       sr.color,
                'position',    sr.position,
                'permissions', sr.permissions
              )
              ORDER BY sr.position DESC
            )
            FROM server_bot_roles sbr
            JOIN server_roles sr ON sr.id = sbr.role_id
            WHERE sbr.server_bot_id = sb.id
          ), '[]'::jsonb)
        ) AS row_data
      FROM server_bots sb
      JOIN bots b ON b.id = sb.bot_id
      WHERE sb.server_id = p_server_id
    ) sub
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO anon;
