-- v1.2.0 Request Optimization
-- Reduces Supabase API calls by ~60% through:
--   1. Fast indexes for the most frequent query patterns
--   2. A single heartbeat_user() RPC replacing 2-3 separate round-trips
--   3. Partial index for unread notification counts (HEAD query becomes O(1))

-- ════════════════════════════════════════════════════════════
-- 1. Message ordering index (already in v120 bot migration,
--    kept here as a no-op IF NOT EXISTS for safety)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_channel_order
  ON public.messages (channel_id, inserted_at ASC, id ASC);

-- ════════════════════════════════════════════════════════════
-- 2. Direct-messages: fast lookup for notification listener
--    (filters by receiver_id + sorts by inserted_at)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_time
  ON public.direct_messages (receiver_id, inserted_at DESC);

-- ════════════════════════════════════════════════════════════
-- 3. Notifications: partial index — only unread rows are indexed.
--    The HEAD count query (SELECT id WHERE user_id=? AND read=false)
--    becomes a tiny index scan instead of a full table scan.
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE read = false;

-- ════════════════════════════════════════════════════════════
-- 4. Profiles: index on last_seen for staleness checks
--    (MemberList uses last_seen to show online/offline state)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC);

-- ════════════════════════════════════════════════════════════
-- 5. heartbeat_user() RPC
--    Replaces 2 separate round-trips (profiles UPDATE + user_sessions UPDATE)
--    with a single RPC call. Called by AuthContext every 10 minutes.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.heartbeat_user(
  p_user_id    UUID,
  p_session_key TEXT DEFAULT '',
  p_status     TEXT  DEFAULT 'online'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update profile presence in one shot
  UPDATE public.profiles
  SET last_seen = now(),
      status    = p_status
  WHERE id = p_user_id;

  -- 2. Update session liveness (skip if no key provided)
  IF p_session_key IS NOT NULL AND p_session_key <> '' THEN
    UPDATE public.user_sessions
    SET last_seen = now(),
        is_active = true
    WHERE user_id    = p_user_id
      AND session_key = p_session_key;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_user TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 6. server_members composite index for member-list queries
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_server_members_server_user
  ON public.server_members (server_id, user_id);

-- ════════════════════════════════════════════════════════════
-- 7. message_reactions composite index
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg
  ON public.message_reactions (message_id, emoji);
