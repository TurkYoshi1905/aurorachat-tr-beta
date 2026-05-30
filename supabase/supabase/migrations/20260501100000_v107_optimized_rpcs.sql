-- ============================================================
-- v107: Toplu veri çekme RPC'leri (optimized batch-fetch RPCs)
-- 4 ayrı Supabase sorgusunu tek RPC çağrısına indirger.
-- ============================================================

-- -----------------------------------------------------------
-- RPC 1: get_user_servers_full
-- Kullanıcının üyesi olduğu tüm sunucuları, kanalları ve
-- kategorileri tek sorguda döndürür (3 query → 1 RPC).
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_servers_full(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_ids uuid[];
BEGIN
  SELECT array_agg(sm.server_id ORDER BY COALESCE(sm.order_index, 0) ASC, sm.joined_at ASC)
  INTO v_server_ids
  FROM server_members sm
  WHERE sm.user_id = p_user_id;

  IF v_server_ids IS NULL OR array_length(v_server_ids, 1) = 0 THEN
    RETURN '{"order":[],"servers":[],"channels":[],"categories":[]}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'order', COALESCE((
      SELECT jsonb_agg(sm.server_id::text ORDER BY COALESCE(sm.order_index, 0) ASC, sm.joined_at ASC)
      FROM server_members sm
      WHERE sm.user_id = p_user_id
    ), '[]'::jsonb),
    'servers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id::text,
        'name', s.name,
        'icon', s.icon,
        'owner_id', s.owner_id::text,
        'word_filter', COALESCE(s.word_filter, '[]'::jsonb),
        'word_filter_exempt_role_ids', COALESCE(s.word_filter_exempt_role_ids, '[]'::jsonb),
        'created_at', s.created_at
      ))
      FROM servers s
      WHERE s.id = ANY(v_server_ids)
    ), '[]'::jsonb),
    'channels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id::text,
        'name', c.name,
        'type', c.type,
        'position', COALESCE(c.sort_order, c.position, 0),
        'server_id', c.server_id::text,
        'category_id', c.category_id::text,
        'is_locked', COALESCE(c.is_locked, false),
        'slow_mode_interval', COALESCE(c.slow_mode_interval, 0)
      ) ORDER BY COALESCE(c.sort_order, c.position, 0))
      FROM channels c
      WHERE c.server_id = ANY(v_server_ids)
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cat.id::text,
        'name', cat.name,
        'position', cat.position,
        'server_id', cat.server_id::text
      ) ORDER BY cat.position)
      FROM channel_categories cat
      WHERE cat.server_id = ANY(v_server_ids)
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_servers_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_servers_full(uuid) TO anon;


-- -----------------------------------------------------------
-- RPC 2: get_server_members_full
-- Sunucunun tüm üyelerini profil ve rol bilgisiyle tek
-- sorguda döndürür (4 query → 1 RPC).
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'member_id', sm.id::text,
        'user_id', sm.user_id::text,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'status', p.status,
        'bio', p.bio,
        'banner_color', p.banner_color,
        'is_premium', COALESCE(p.is_premium, false),
        'has_premium_badge', COALESCE(p.has_premium_badge, false),
        'has_basic_badge', COALESCE(p.has_basic_badge, false),
        'roles', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', sr.id::text,
              'name', sr.name,
              'color', sr.color,
              'position', sr.position,
              'permissions', sr.permissions
            )
            ORDER BY sr.position DESC
          )
          FROM server_member_roles smr
          JOIN server_roles sr ON sr.id = smr.role_id
          WHERE smr.member_id = sm.id
        ), '[]'::jsonb)
      )
    )
    FROM server_members sm
    JOIN profiles p ON p.id = sm.user_id
    WHERE sm.server_id = p_server_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO anon;
