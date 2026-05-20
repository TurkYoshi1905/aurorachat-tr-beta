-- ============================================================
-- v1.2.2 — Veritabanı Optimizasyonu
-- Connection pool tükenmesi, sorgu zaman aşımları ve
-- bağlantı sızıntılarına karşı kapsamlı düzeltmeler.
-- NOT: CONCURRENTLY kaldırıldı — SQL Editor transaction bloğu
--      içinde çalışır, CONCURRENTLY buna izin vermez.
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

CREATE INDEX IF NOT EXISTS idx_messages_channel_inserted
  ON public.messages (channel_id, inserted_at);


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
-- 7. REACTIONS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reactions_message_id
  ON public.reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_reactions_user_message
  ON public.reactions (user_id, message_id);


-- ─────────────────────────────────────────────
-- 8. VOICE_CHANNEL_MEMBERS İNDEKSLERİ
-- Tablo yoksa sessizce atla
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'voice_channel_members'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_voice_channel_members_channel_id') THEN
      CREATE INDEX idx_voice_channel_members_channel_id
        ON public.voice_channel_members (channel_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_voice_channel_members_user_id') THEN
      CREATE INDEX idx_voice_channel_members_user_id
        ON public.voice_channel_members (user_id);
    END IF;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────
-- 9. PROFILES İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC);


-- ─────────────────────────────────────────────
-- 10. MESSAGE_THREADS İNDEKSLERİ
-- Tablo yoksa sessizce atla
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_threads'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_message_threads_message_id') THEN
      CREATE INDEX idx_message_threads_message_id
        ON public.message_threads (message_id);
    END IF;
  END IF;
END;
$$;


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
-- Tablo yoksa sessizce atla
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'announcements'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_announcements_created_at') THEN
      CREATE INDEX idx_announcements_created_at
        ON public.announcements (created_at DESC);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'announcement_comments'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_announcement_comments_announcement_id') THEN
      CREATE INDEX idx_announcement_comments_announcement_id
        ON public.announcement_comments (announcement_id);
    END IF;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────
-- 14. BAĞLANTI HAVUZUNU TEMIZLE
-- Uzun süre idle kalan bağlantıları kapat
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
-- 15. VACUUM + ANALYZE — sorgu planlayıcısını güncelle
-- ─────────────────────────────────────────────
ANALYZE public.messages;
ANALYZE public.server_members;
ANALYZE public.server_member_roles;
ANALYZE public.notifications;
ANALYZE public.reactions;
ANALYZE public.profiles;
ANALYZE public.channels;
ANALYZE public.server_bots;
