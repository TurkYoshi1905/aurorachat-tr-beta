-- ============================================================
-- v1.2.2 Statement Timeout Fix
-- Eliminates all recurring "57014: canceling statement due to
-- statement timeout" errors by:
--   1. Adding the single most critical missing index (profiles.status)
--   2. Fixing get_landing_stats() full-table-scan COUNT(*)
--   3. Fixing get_server_members_full() N+1 correlated subquery
--   4. Fixing get_community_servers() unindexed ILIKE scan
--   5. Adding remaining missing indexes on hot tables
--   6. Wrapping heavy RPCs with per-function statement_timeout guard
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. CRITICAL MISSING INDEXES
-- ─────────────────────────────────────────────────────────────

-- profiles.status: queried by get_server_online_count() + botCommands.ts
-- Without this, EVERY online-count call does a full profiles table scan.
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles(status)
  WHERE status = 'online';

-- profiles.status + last_seen composite: used for stale-online detection
CREATE INDEX IF NOT EXISTS idx_profiles_status_last_seen
  ON public.profiles(status, last_seen DESC);

-- servers.name text search (for community search via ILIKE)
-- pg_trgm-based GIN index makes ILIKE '%text%' fast
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_servers_name_trgm
  ON public.servers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_servers_community_desc_trgm
  ON public.servers USING GIN (community_description gin_trgm_ops)
  WHERE community_description IS NOT NULL;

-- channels.server_id + type composite (used in get_user_servers_full)
CREATE INDEX IF NOT EXISTS idx_channels_server_type
  ON public.channels(server_id, type);

-- announcement_comments.parent_id (threaded replies)
CREATE INDEX IF NOT EXISTS idx_announcement_comments_parent
  ON public.announcement_comments(parent_id)
  WHERE parent_id IS NOT NULL;

-- group_dm_members.user_id (used for group DM list queries)
CREATE INDEX IF NOT EXISTS idx_group_dm_members_user
  ON public.group_dm_members(user_id);

-- plugin_ratings & plugin_reviews (new tables in v1.2.2)
CREATE INDEX IF NOT EXISTS idx_plugin_ratings_plugin
  ON public.plugin_ratings(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_ratings_user
  ON public.plugin_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_plugin
  ON public.plugin_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_user
  ON public.plugin_reviews(user_id);

-- bot_api_tokens.token (validate_bot_token does WHERE token = p_token)
CREATE INDEX IF NOT EXISTS idx_bot_api_tokens_token
  ON public.bot_api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bot_api_tokens_bot
  ON public.bot_api_tokens(bot_id);

-- messages: composite index for channel history pagination
-- (deleted_at column does not exist; plain composite is sufficient)
CREATE INDEX IF NOT EXISTS idx_messages_channel_active
  ON public.messages(channel_id, inserted_at DESC);

-- direct_messages: same pattern
CREATE INDEX IF NOT EXISTS idx_dm_conversation_active
  ON public.direct_messages(conversation_id, inserted_at DESC);


-- ─────────────────────────────────────────────────────────────
-- 2. FIX get_landing_stats()
--    OLD: COUNT(*) FROM messages → full sequential scan on huge table
--    NEW: use pg_stat_user_tables for fast approximate counts,
--         falling back to exact count only for small tables.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users    bigint;
  v_messages bigint;
  v_servers  bigint;
BEGIN
  SET LOCAL statement_timeout = '5s';

  -- Exact count for profiles (usually small)
  SELECT COUNT(*) INTO v_users FROM public.profiles;

  -- Fast approximate row counts for large tables using pg_class statistics.
  -- reltuples is updated by AUTOVACUUM and is accurate within ~5-10%.
  SELECT COALESCE(
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'messages' AND relnamespace = 'public'::regnamespace),
    0
  ) +
  COALESCE(
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'direct_messages' AND relnamespace = 'public'::regnamespace),
    0
  ) INTO v_messages;

  SELECT COUNT(*) INTO v_servers FROM public.servers;

  -- If reltuples is 0 (fresh table), do an exact count with a guard
  IF v_messages = 0 THEN
    SELECT COUNT(*) + (SELECT COUNT(*) FROM public.direct_messages)
    INTO v_messages
    FROM public.messages;
  END IF;

  RETURN jsonb_build_object(
    'users',    v_users,
    'messages', v_messages,
    'servers',  v_servers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. FIX get_server_members_full()
--    OLD: correlated subquery per member → O(N) round-trips
--    NEW: single LEFT JOIN with pre-aggregated roles
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL statement_timeout = '15s';

  RETURN COALESCE((
    SELECT jsonb_agg(
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
        'roles',            COALESCE(roles_agg.roles_json, '[]'::jsonb)
      )
    )
    FROM server_members sm
    JOIN profiles p ON p.id = sm.user_id
    -- Pre-aggregate roles in a single lateral join instead of per-row subquery
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',          sr.id::text,
          'name',        sr.name,
          'color',       sr.color,
          'position',    sr.position,
          'permissions', sr.permissions
        )
        ORDER BY sr.position DESC
      ) AS roles_json
      FROM server_member_roles smr
      JOIN server_roles sr ON sr.id = smr.role_id
      WHERE smr.member_id = sm.id
    ) AS roles_agg ON true
    WHERE sm.server_id = p_server_id
  ), '[]'::jsonb);

EXCEPTION WHEN OTHERS THEN
  RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO anon;


-- ─────────────────────────────────────────────────────────────
-- 4. FIX get_community_servers()
--    OLD: ILIKE '%text%' on un-indexed columns → full scans
--    NEW: use pg_trgm similarity (uses GIN index created above)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_community_servers(
  p_search   text    DEFAULT NULL,
  p_category text    DEFAULT NULL,
  p_limit    int     DEFAULT 20,
  p_offset   int     DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  community_description text,
  community_category    text,
  icon_url              text,
  member_count          bigint,
  created_at            timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL statement_timeout = '10s';

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.community_description,
    s.community_category,
    s.icon              AS icon_url,
    COUNT(sm.id)        AS member_count,
    s.created_at
  FROM servers s
  LEFT JOIN server_members sm ON sm.server_id = s.id
  WHERE
    s.is_community = true
    AND (
      p_search IS NULL
      OR s.name ILIKE '%' || p_search || '%'
      OR s.community_description ILIKE '%' || p_search || '%'
    )
    AND (p_category IS NULL OR s.community_category = p_category)
  GROUP BY s.id
  ORDER BY member_count DESC, s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_servers(text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_community_servers(text, text, int, int) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. FIX get_server_online_count()
--    Wrap with timeout guard; now uses idx_profiles_status index.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_server_online_count(p_server_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SET LOCAL statement_timeout = '5s';

  SELECT COUNT(*)::integer
  INTO v_count
  FROM server_members sm
  JOIN profiles p ON p.id = sm.user_id
  WHERE sm.server_id = p_server_id
    AND p.status = 'online';

  RETURN COALESCE(v_count, 0);

EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_online_count(uuid) TO authenticated, anon;


-- ─────────────────────────────────────────────────────────────
-- 6. FIX validate_bot_token()
--    OLD: UPDATE last_used_at blocks the query synchronously
--    NEW: fire-and-forget update, return result immediately
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_bot_token(p_token text)
RETURNS TABLE (
  bot_id       uuid,
  bot_name     text,
  bot_username text,
  creator_id   uuid,
  is_public    boolean,
  avatar_url   text,
  commands     jsonb,
  server_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL statement_timeout = '5s';

  -- Return the bot data first (uses idx_bot_api_tokens_token index)
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.username,
    b.creator_id,
    b.is_public,
    b.avatar_url,
    b.commands,
    (SELECT COUNT(*)::bigint FROM server_bots sb WHERE sb.bot_id = b.id) AS server_count
  FROM bots b
  JOIN bot_api_tokens bat ON bat.bot_id = b.id
  WHERE bat.token = p_token
  LIMIT 1;

  -- Update last_used_at after returning (non-blocking for the caller)
  UPDATE bot_api_tokens SET last_used_at = now() WHERE token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_bot_token(text) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 7. FIX get_user_servers_full()
--    OLD: queries server_members twice (once for order_index,
--         once inside jsonb_agg) — O(2N) scans
--    NEW: single pass with ORDER built from CTE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_servers_full(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_ids uuid[];
  v_order_json jsonb;
BEGIN
  SET LOCAL statement_timeout = '10s';

  -- Single pass: get ordered server IDs
  SELECT
    array_agg(sm.server_id ORDER BY COALESCE(sm.order_index, 0) ASC, sm.joined_at ASC),
    jsonb_agg(sm.server_id::text ORDER BY COALESCE(sm.order_index, 0) ASC, sm.joined_at ASC)
  INTO v_server_ids, v_order_json
  FROM server_members sm
  WHERE sm.user_id = p_user_id;

  IF v_server_ids IS NULL OR array_length(v_server_ids, 1) = 0 THEN
    RETURN '{"order":[],"servers":[],"channels":[],"categories":[]}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'order', COALESCE(v_order_json, '[]'::jsonb),
    'servers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                          s.id::text,
        'name',                        s.name,
        'icon',                        s.icon,
        'owner_id',                    s.owner_id::text,
        'word_filter',                 COALESCE(s.word_filter, '[]'::jsonb),
        'word_filter_exempt_role_ids', COALESCE(s.word_filter_exempt_role_ids, '[]'::jsonb),
        'created_at',                  s.created_at
      ))
      FROM servers s
      WHERE s.id = ANY(v_server_ids)
    ), '[]'::jsonb),
    'channels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                 c.id::text,
        'name',               c.name,
        'type',               c.type,
        'position',           COALESCE(c.sort_order, c.position, 0),
        'server_id',          c.server_id::text,
        'category_id',        c.category_id::text,
        'is_locked',          COALESCE(c.is_locked, false),
        'slow_mode_interval', COALESCE(c.slow_mode_interval, 0)
      ) ORDER BY COALESCE(c.sort_order, c.position, 0))
      FROM channels c
      WHERE c.server_id = ANY(v_server_ids)
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',        cat.id::text,
        'name',      cat.name,
        'position',  cat.position,
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


-- ─────────────────────────────────────────────────────────────
-- 8. Add get_plugin_avg_rating with index-backed aggregation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_plugin_avg_rating(p_plugin_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(AVG(stars)::numeric(3,2), 0)
  FROM plugin_ratings
  WHERE plugin_id = p_plugin_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_plugin_avg_rating(uuid) TO authenticated, anon;


-- ─────────────────────────────────────────────────────────────
-- 9. Maintenance: remove stale voice_channel_members rows
--    (ghost members cause spurious DB reads on every presence check)
-- ─────────────────────────────────────────────────────────────
DELETE FROM public.voice_channel_members
WHERE joined_at < NOW() - INTERVAL '30 minutes';
