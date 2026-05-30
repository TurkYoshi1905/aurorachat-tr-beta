-- v1.1.2: Include last_seen in get_server_members_full so the client
-- can apply a staleness check (hidden/closed tabs stop updating last_seen).
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
          'last_seen',        p.last_seen,
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

      SELECT
        jsonb_build_object(
          'member_id',        sb.id::text,
          'user_id',          b.id::text,
          'username',         b.username,
          'display_name',     b.name,
          'avatar_url',       b.avatar_url,
          'status',           'online',
          'last_seen',        null,
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
