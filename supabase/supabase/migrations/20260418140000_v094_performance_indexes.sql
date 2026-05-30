-- v094: Critical performance indexes for high-load queries
-- These indexes significantly reduce database CPU usage on Nano compute.

-- 1. Notifications: most queried by user_id + ordering/filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read)
  WHERE read = false;

-- 2. Channel categories: queried in every fetchServers() call
CREATE INDEX IF NOT EXISTS idx_channel_categories_server
  ON public.channel_categories(server_id, position);

-- 3. Friends: queried by both user_id and friend_id in DMDashboard
CREATE INDEX IF NOT EXISTS idx_friends_user_id
  ON public.friends(user_id, status);

CREATE INDEX IF NOT EXISTS idx_friends_friend_id
  ON public.friends(friend_id, status);

-- 4. Spotify now playing: polled every 30s per user
CREATE INDEX IF NOT EXISTS idx_spotify_now_playing_user
  ON public.spotify_now_playing(user_id);

-- 5. User sessions: queried per user for ConnectedDevices
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_key
  ON public.user_sessions(user_id, session_key);

-- 6. Message reactions: queried by message_id in bulk
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions(message_id);

-- 7. Messages: composite index for the new DESC+LIMIT pattern
CREATE INDEX IF NOT EXISTS idx_messages_channel_desc
  ON public.messages(channel_id, inserted_at DESC);

-- 8. Direct messages: same DESC+LIMIT pattern
CREATE INDEX IF NOT EXISTS idx_dm_channel_desc
  ON public.direct_messages(conversation_id, inserted_at DESC);

-- 9. Server members: composite for join queries
CREATE INDEX IF NOT EXISTS idx_server_members_composite
  ON public.server_members(user_id, server_id);
