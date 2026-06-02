-- ============================================================
-- v1.2.2 — Veritabanı Optimizasyonu
-- Connection pool tükenmesi, sorgu zaman aşımları ve
-- bağlantı sızıntılarına karşı kapsamlı düzeltmeler.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. UZUN SÜREN AKTİF SORGULARI SONLANDIR
-- ─────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pid
    FROM pg_stat_activity
    WHERE state IN ('active', 'idle in transaction')
      AND now() - query_start > interval '30 seconds'
      AND pid <> pg_backend_pid()
      AND query NOT LIKE '%pg_stat_activity%'
  LOOP
    PERFORM pg_terminate_backend(r.pid);
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────
-- 2. STATEMENT TIMEOUT — uzun sorguları kes
-- ─────────────────────────────────────────────
ALTER DATABASE postgres SET statement_timeout = '15s';
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';
ALTER DATABASE postgres SET lock_timeout = '10s';


-- ─────────────────────────────────────────────
-- 3. MESSAGES TABLOSU İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_channel_id
  ON public.messages (channel_id, inserted_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages (user_id);


-- ─────────────────────────────────────────────
-- 4. SERVER_MEMBERS İNDEKSLERİ
-- RLS her satırda server_members'ı sorgular
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_server_members_user_id
  ON public.server_members (user_id);

CREATE INDEX IF NOT EXISTS idx_server_members_server_id
  ON public.server_members (server_id);

CREATE INDEX IF NOT EXISTS idx_server_members_server_user
  ON public.server_members (server_id, user_id);


-- ─────────────────────────────────────────────
-- 5. SERVER_MEMBER_ROLES İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_server_member_roles_member_id
  ON public.server_member_roles (member_id);

CREATE INDEX IF NOT EXISTS idx_server_member_roles_role_id
  ON public.server_member_roles (role_id);


-- ─────────────────────────────────────────────
-- 6. NOTIFICATIONS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);


-- ─────────────────────────────────────────────
-- 7. MESSAGE_REACTIONS İNDEKSLERİ
-- (tablo adı: message_reactions — reactions değil)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON public.message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user_message
  ON public.message_reactions (user_id, message_id);


-- ─────────────────────────────────────────────
-- 8. VOICE_CHANNEL_MEMBERS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_voice_channel_members_channel_id
  ON public.voice_channel_members (channel_id);

CREATE INDEX IF NOT EXISTS idx_voice_channel_members_user_id
  ON public.voice_channel_members (user_id);


-- ─────────────────────────────────────────────
-- 9. PROFILES İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC);


-- ─────────────────────────────────────────────
-- 10. THREADS & THREAD_MESSAGES İNDEKSLERİ
-- (message_threads değil — threads + thread_messages)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_threads_message_id
  ON public.threads (message_id);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id
  ON public.thread_messages (thread_id);


-- ─────────────────────────────────────────────
-- 11. CHANNELS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_channels_server_id
  ON public.channels (server_id, position);

CREATE INDEX IF NOT EXISTS idx_channels_id_server_id
  ON public.channels (id, server_id);


-- ─────────────────────────────────────────────
-- 12. SERVER_BOTS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_server_bots_server_id
  ON public.server_bots (server_id);

CREATE INDEX IF NOT EXISTS idx_server_bots_bot_id
  ON public.server_bots (bot_id);


-- ─────────────────────────────────────────────
-- 13. ANNOUNCEMENTS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_created_at
  ON public.announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_id
  ON public.announcement_comments (announcement_id);


-- ─────────────────────────────────────────────
-- 14. DM & GROUP DM İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id
  ON public.direct_messages (conversation_id, inserted_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_dm_messages_group_id
  ON public.group_dm_messages (group_id, inserted_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_dm_members_group_id
  ON public.group_dm_members (group_id);

CREATE INDEX IF NOT EXISTS idx_group_dm_members_user_id
  ON public.group_dm_members (user_id);


-- ─────────────────────────────────────────────
-- 15. BAĞLANTI HAVUZUNU TEMIZLE
-- ─────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pid
    FROM pg_stat_activity
    WHERE state = 'idle in transaction'
      AND now() - state_change > interval '60 seconds'
      AND pid <> pg_backend_pid()
  LOOP
    PERFORM pg_terminate_backend(r.pid);
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────
-- 16. ANALYZE — sorgu planlayıcısını güncelle
-- ─────────────────────────────────────────────
ANALYZE public.messages;
ANALYZE public.server_members;
ANALYZE public.server_member_roles;
ANALYZE public.notifications;
ANALYZE public.message_reactions;
ANALYZE public.profiles;
ANALYZE public.channels;
ANALYZE public.server_bots;
ANALYZE public.voice_channel_members;
ANALYZE public.threads;
ANALYZE public.thread_messages;
ANALYZE public.direct_messages;
ANALYZE public.group_dm_messages;
ANALYZE public.announcements;
ANALYZE public.announcement_comments;
