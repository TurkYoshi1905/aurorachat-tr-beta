-- v1.1.9 Optimization Migration: Additional indexes + RLS recursion guards
-- Fixes Supabase "Unhealthy" status caused by excessive DB requests from 3-4 concurrent users.

-- ════════════════════════════════════════════════════════════
-- 1. ADDITIONAL PERFORMANCE INDEXES
-- ════════════════════════════════════════════════════════════

-- voice_channel_members: queried on every voice join/leave/heartbeat
CREATE INDEX IF NOT EXISTS idx_voice_channel_members_user
  ON public.voice_channel_members(user_id);

CREATE INDEX IF NOT EXISTS idx_voice_channel_members_channel
  ON public.voice_channel_members(channel_id);

-- account_bans: checked on login and watched via realtime
CREATE INDEX IF NOT EXISTS idx_account_bans_user_active
  ON public.account_bans(banned_user_id, active)
  WHERE active = true;

-- mod_role_assignments: queried in ModerationPage and canAccess checks
CREATE INDEX IF NOT EXISTS idx_mod_role_assignments_user
  ON public.mod_role_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_mod_role_assignments_assigned_to
  ON public.mod_role_assignments(assigned_to_user_id);

-- announcements: ordered by created_at DESC for listing
CREATE INDEX IF NOT EXISTS idx_announcements_created_desc
  ON public.announcements(created_at DESC);

-- announcement_comments: queried per announcement
CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement
  ON public.announcement_comments(announcement_id, created_at ASC);

-- banned_ips: checked on each request via Aurora Guard
CREATE INDEX IF NOT EXISTS idx_banned_ips_ip
  ON public.banned_ips(ip_address);

-- rate_limit_cooldowns: checked per user_id
CREATE INDEX IF NOT EXISTS idx_rate_limit_cooldowns_user
  ON public.rate_limit_cooldowns(user_id);

-- user_login_ips: queried per user for ConnectedDevices / ModerationPage
CREATE INDEX IF NOT EXISTS idx_user_login_ips_user
  ON public.user_login_ips(user_id);

-- direct_messages: queried by conversation_id with ordering
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv_desc
  ON public.direct_messages(conversation_id, inserted_at DESC);

-- dm_conversations: queried by user1_id and user2_id in DMDashboard
CREATE INDEX IF NOT EXISTS idx_dm_conversations_user1
  ON public.dm_conversations(user1_id);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_user2
  ON public.dm_conversations(user2_id);

-- server_member_roles: queried per member and per role
CREATE INDEX IF NOT EXISTS idx_server_member_roles_member
  ON public.server_member_roles(member_id);

CREATE INDEX IF NOT EXISTS idx_server_member_roles_role
  ON public.server_member_roles(role_id);

-- server_bots: queried per server_id and bot_id
CREATE INDEX IF NOT EXISTS idx_server_bots_server
  ON public.server_bots(server_id);

CREATE INDEX IF NOT EXISTS idx_server_bots_bot
  ON public.server_bots(bot_id);

-- bots: queried by creator_id
CREATE INDEX IF NOT EXISTS idx_bots_creator
  ON public.bots(creator_id);

-- plugins: queried by creator_id and status in store
CREATE INDEX IF NOT EXISTS idx_plugins_creator
  ON public.plugins(creator_id);

CREATE INDEX IF NOT EXISTS idx_plugins_status
  ON public.plugins(status);

-- user_plugins: queried per user_id
CREATE INDEX IF NOT EXISTS idx_user_plugins_user
  ON public.user_plugins(user_id);

-- notifications: already indexed by user_id+created_at but add read filter index
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, read, created_at DESC);

-- messages: index on bot_id for custom bot message queries
CREATE INDEX IF NOT EXISTS idx_messages_bot_id
  ON public.messages(bot_id)
  WHERE bot_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 2. RLS RECURSION GUARDS
-- ════════════════════════════════════════════════════════════

-- Ensure is_app_admin_check security definer function exists (idempotent)
CREATE OR REPLACE FUNCTION public.is_app_admin_check(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_app_admin FROM public.profiles WHERE id = user_id LIMIT 1),
    false
  );
$$;

-- Ensure is_server_member security definer function exists
-- Used to avoid self-referencing RLS on server_members table
CREATE OR REPLACE FUNCTION public.is_server_member_check(p_server_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = p_user_id
    LIMIT 1
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 3. VOICE CHANNEL MEMBERS — stale row cleanup
-- ════════════════════════════════════════════════════════════

-- Remove voice rows older than 10 minutes to prevent ghost members
-- (safe to run idempotently; rows are re-inserted on join)
DELETE FROM public.voice_channel_members
WHERE joined_at < NOW() - INTERVAL '10 minutes';

-- ════════════════════════════════════════════════════════════
-- 4. GRANT SELECT on new helper functions
-- ════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.is_app_admin_check(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_server_member_check(UUID, UUID) TO authenticated, anon;
