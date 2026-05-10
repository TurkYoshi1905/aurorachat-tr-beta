-- v1.1.0: server_bot_roles — Sunucudaki botlara rol atama tablosu
-- Botlar server_members tablosunda değil server_bots tablosunda tutulduğundan
-- rol atamaları için ayrı bir tablo gereklidir.

CREATE TABLE IF NOT EXISTS public.server_bot_roles (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  server_bot_id uuid NOT NULL REFERENCES public.server_bots(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (server_bot_id, role_id)
);

ALTER TABLE public.server_bot_roles ENABLE ROW LEVEL SECURITY;

-- Sunucu üyeleri okuyabilir
CREATE POLICY "server_bot_roles_select" ON public.server_bot_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.server_bots sb
      JOIN public.server_members sm ON sm.server_id = sb.server_id
      WHERE sb.id = server_bot_roles.server_bot_id
        AND sm.user_id = auth.uid()
    )
  );

-- Sunucu sahibi veya yönetici rol atayabilir
CREATE POLICY "server_bot_roles_insert" ON public.server_bot_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.server_bots sb
      JOIN public.servers s ON s.id = sb.server_id
      WHERE sb.id = server_bot_roles.server_bot_id
        AND s.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.server_bots sb
      JOIN public.server_members sm ON sm.server_id = sb.server_id
      JOIN public.server_member_roles smr ON smr.member_id = sm.id
      JOIN public.server_roles sr ON sr.id = smr.role_id
      WHERE sb.id = server_bot_roles.server_bot_id
        AND sm.user_id = auth.uid()
        AND (
          (sr.permissions->>'administrator')::boolean = true
          OR (sr.permissions->>'manage_roles')::boolean = true
        )
    )
  );

-- Sunucu sahibi veya yönetici rol kaldırabilir
CREATE POLICY "server_bot_roles_delete" ON public.server_bot_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.server_bots sb
      JOIN public.servers s ON s.id = sb.server_id
      WHERE sb.id = server_bot_roles.server_bot_id
        AND s.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.server_bots sb
      JOIN public.server_members sm ON sm.server_id = sb.server_id
      JOIN public.server_member_roles smr ON smr.member_id = sm.id
      JOIN public.server_roles sr ON sr.id = smr.role_id
      WHERE sb.id = server_bot_roles.server_bot_id
        AND sm.user_id = auth.uid()
        AND (
          (sr.permissions->>'administrator')::boolean = true
          OR (sr.permissions->>'manage_roles')::boolean = true
        )
    )
  );

-- get_server_members_full RPC: botların rollerini de dahil et
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
      -- ── Regular human members ────────────────────────────────
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

      -- ── Bots added to this server ────────────────────────────
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
