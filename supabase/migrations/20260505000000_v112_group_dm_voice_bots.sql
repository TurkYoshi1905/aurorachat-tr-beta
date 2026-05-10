-- v1.1.2: Group DM Voice Calls, Bot Profile Editing, manage_bots permission
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. GROUP DM VOICE CALLS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_dm_voice_calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.group_dms(id) ON DELETE CASCADE,
  started_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_group_dm_voice_calls_group_id ON public.group_dm_voice_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_dm_voice_calls_active ON public.group_dm_voice_calls(is_active) WHERE is_active = true;

ALTER TABLE public.group_dm_voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_dm_voice_calls_select" ON public.group_dm_voice_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_dm_members gdm
      WHERE gdm.group_id = group_dm_voice_calls.group_id
        AND gdm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_dm_voice_calls_insert" ON public.group_dm_voice_calls
  FOR INSERT WITH CHECK (
    started_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_dm_members gdm
      WHERE gdm.group_id = group_dm_voice_calls.group_id
        AND gdm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_dm_voice_calls_update" ON public.group_dm_voice_calls
  FOR UPDATE USING (started_by = auth.uid());

-- Realtime for group DM voice calls
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_dm_voice_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_voice_calls;
  END IF;
END $$;

ALTER TABLE public.group_dm_voice_calls REPLICA IDENTITY FULL;

-- ── 2. FIX server_bots INSERT POLICY to allow bot owners ───────────────
DROP POLICY IF EXISTS "Server owners can manage bots" ON public.server_bots;

CREATE POLICY "Server owners and bot owners can manage bots" ON public.server_bots
  USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_bots.server_id AND s.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.bots b
      WHERE b.id = server_bots.bot_id AND b.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.server_members sm
      JOIN public.server_member_roles smr ON smr.member_id = sm.id
      JOIN public.server_roles sr ON sr.id = smr.role_id
      WHERE sm.server_id = server_bots.server_id
        AND sm.user_id = auth.uid()
        AND (
          (sr.permissions->>'administrator')::boolean = true
          OR (sr.permissions->>'manage_bots')::boolean = true
        )
    )
  );

-- ── 3. FIX server_bots SELECT POLICY to also allow bot owners ──────────
DROP POLICY IF EXISTS "Server members can view server bots" ON public.server_bots;

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

-- ── 4. BOTS: add realtime publication ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bots;
  END IF;
END $$;

ALTER TABLE public.bots REPLICA IDENTITY FULL;

-- ── 5. BOTS: allow bot owners to update their bots (already covered by existing policy) ──
-- The existing "Bot owners can manage their bots" policy handles UPDATE/DELETE.
-- Ensure the bots table has is_public SELECT policy updated for wider discovery.
DROP POLICY IF EXISTS "Anyone can view public bots" ON public.bots;

CREATE POLICY "Anyone can view bots" ON public.bots
  FOR SELECT USING (true);

-- ── 6. SERVER_BOTS: add realtime ──────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_bots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_bots;
  END IF;
END $$;

ALTER TABLE public.server_bots REPLICA IDENTITY FULL;

-- ── 7. Updated get_server_members_full with last_seen ─────────────────────
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_data)
    FROM (
      SELECT
        jsonb_build_object(
          'member_id',        sm.id::text,
          'user_id',          sm.user_id::text,
          'username',         p.username,
          'display_name',     p.display_name,
          'avatar_url',       p.avatar_url,
          'status',           p.status,
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
