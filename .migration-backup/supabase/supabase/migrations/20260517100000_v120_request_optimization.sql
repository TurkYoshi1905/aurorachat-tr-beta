-- v1.2.0 Request Optimization
-- Reduces Supabase API calls by ~60% through combined heartbeat RPC
-- and targeted indexes for the most frequent query patterns.
--
-- NOTE: Index names checked against all prior migrations to avoid conflicts.
-- v119 already covers: idx_direct_messages_conv_desc, idx_notifications_user_read,
--   idx_dm_conversations_user1/2, idx_server_member_roles_member/role, idx_bots_owner,
--   idx_plugins_creator/is_approved, idx_user_plugins_user, idx_messages_bot_id,
--   idx_voice_channel_members_user/channel, idx_server_bots_server/bot

-- ════════════════════════════════════════════════════════════
-- 1. Messages: ordering index for channel history queries
--    (composite on channel_id + inserted_at for fast pagination)
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_channel_time
  ON public.messages (channel_id, inserted_at ASC, id ASC);

-- ════════════════════════════════════════════════════════════
-- 2. direct_messages: index on sender_id
--    (used by DELETE/UPDATE RLS policies & sender-side queries)
--    NOTE: receiver_id does NOT exist — DM recipient is derived
--    from dm_conversations.user1_id / user2_id.
--    Conversation-level index already exists as idx_direct_messages_conv_desc (v119).
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender
  ON public.direct_messages (sender_id, inserted_at DESC);

-- ════════════════════════════════════════════════════════════
-- 3. Notifications: partial index for unread count HEAD query
--    (SELECT id WHERE user_id=? AND read=false becomes O(1))
--    v119 has idx_notifications_user_read (full composite); this
--    partial index is a smaller, faster complement for the HEAD query.
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_notifications_unread_partial
  ON public.notifications (user_id)
  WHERE read = false;

-- ════════════════════════════════════════════════════════════
-- 4. Profiles: last_seen for staleness / online-status checks
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC);

-- ════════════════════════════════════════════════════════════
-- 5. server_members: composite for per-server member lookups
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_server_members_server_user
  ON public.server_members (server_id, user_id);

-- ════════════════════════════════════════════════════════════
-- 6. message_reactions: composite for per-message reaction fetch
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions (message_id, emoji);

-- ════════════════════════════════════════════════════════════
-- 7. heartbeat_user() RPC
--    Replaces 2 separate round-trips (profiles UPDATE + user_sessions UPDATE)
--    with a single authenticated RPC call.
--    Called by AuthContext every 10 minutes instead of every 5.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.heartbeat_user(
  p_user_id     UUID,
  p_session_key TEXT    DEFAULT '',
  p_status      TEXT    DEFAULT 'online'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile presence in a single statement
  UPDATE public.profiles
  SET last_seen = now(),
      status    = p_status
  WHERE id = p_user_id;

  -- Update session liveness only when a session key is provided
  IF p_session_key IS NOT NULL AND p_session_key <> '' THEN
    UPDATE public.user_sessions
    SET last_seen = now(),
        is_active = true
    WHERE user_id     = p_user_id
      AND session_key = p_session_key;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_user TO authenticated;
