-- v1.1.0: Update get_server_members_full to include bots from server_bots
-- Bots appear in the members list under a dedicated "Botlar" section.
-- is_bot = true distinguishes bot rows from regular member rows.

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
          'roles',            '[]'::jsonb
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
