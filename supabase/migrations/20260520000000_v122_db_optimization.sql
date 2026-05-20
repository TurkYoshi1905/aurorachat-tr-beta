-- ============================================================
-- v1.2.2 — Veritabanı Optimizasyonu
-- Connection pool tükenmesi, sorgu zaman aşımları ve
-- bağlantı sızıntılarına karşı kapsamlı düzeltmeler.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. UZUN SÜREN AKTİF SORGULARI SONLANDIR
-- (Göç çalışmadan önce köprüyü temizle)
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
-- (Supabase pooler üzerinden oturum başına)
-- ─────────────────────────────────────────────
ALTER DATABASE postgres SET statement_timeout = '15s';
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';
ALTER DATABASE postgres SET lock_timeout = '10s';


-- ─────────────────────────────────────────────
-- 3. MESSAGES TABLOSU İNDEKSLERİ
-- En çok sorgulanan tablo; channel_id + tarih
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_id
  ON public.messages (channel_id, inserted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_id
  ON public.messages (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_inserted
  ON public.messages (channel_id, inserted_at);


-- ─────────────────────────────────────────────
-- 4. SERVER_MEMBERS İNDEKSLERİ
-- RLS her satırda server_members'ı sorgular
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_members_user_id
  ON public.server_members (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_members_server_id
  ON public.server_members (server_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_members_server_user
  ON public.server_members (server_id, user_id);


-- ─────────────────────────────────────────────
-- 5. SERVER_MEMBER_ROLES İNDEKSLERİ
-- Üye rol sorguları için kritik
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_member_roles_member_id
  ON public.server_member_roles (member_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_member_roles_role_id
  ON public.server_member_roles (role_id);


-- ─────────────────────────────────────────────
-- 6. NOTIFICATIONS İNDEKSLERİ
-- Kullanıcı başına okunmamış bildirim sayısı
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read)
  WHERE read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);


-- ─────────────────────────────────────────────
-- 7. REACTIONS İNDEKSLERİ
-- Her mesaj için reaksiyon listesi
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reactions_message_id
  ON public.reactions (message_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reactions_user_message
  ON public.reactions (user_id, message_id);


-- ─────────────────────────────────────────────
-- 8. VOICE_CHANNEL_MEMBERS İNDEKSLERİ
-- Sesli kanal üye sorguları
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_channel_members_channel_id
  ON public.voice_channel_members (channel_id)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_channel_members');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_channel_members_user_id
  ON public.voice_channel_members (user_id)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_channel_members');


-- ─────────────────────────────────────────────
-- 9. PROFILES İNDEKSLERİ
-- Durum sorgulama ve son görülme
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen DESC);


-- ─────────────────────────────────────────────
-- 10. MESSAGE_THREADS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_threads_message_id
  ON public.message_threads (message_id)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_threads');


-- ─────────────────────────────────────────────
-- 11. CHANNELS İNDEKSLERİ
-- Sunucu bazlı kanal listesi
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channels_server_id
  ON public.channels (server_id, position);


-- ─────────────────────────────────────────────
-- 12. SERVER_BOTS İNDEKSLERİ
-- Bot üye listesi sorguları
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_bots_server_id
  ON public.server_bots (server_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_server_bots_bot_id
  ON public.server_bots (bot_id);


-- ─────────────────────────────────────────────
-- 13. ANNOUNCEMENTS İNDEKSLERİ
-- ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcements_created_at
  ON public.announcements (created_at DESC)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_announcement_comments_announcement_id
  ON public.announcement_comments (announcement_id)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcement_comments');


-- ─────────────────────────────────────────────
-- 14. RLS POLİTİKA OPTİMİZASYONU
-- Recursive (döngüsel) RLS sorguları connection
-- havuzunu tüketir. messages tablosunda SELECT
-- politikası server_members'ı kontrol ediyorsa,
-- bu kontrolü index üzerinden hızlandır.
-- ─────────────────────────────────────────────

-- messages RLS: Kullanıcı bu kanalın sunucusuna üye mi?
-- server_members(server_id, user_id) bileşik indexi zaten eklendi (adım 4).
-- Ek: channels(id, server_id) — RLS join için
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channels_id_server_id
  ON public.channels (id, server_id);


-- ─────────────────────────────────────────────
-- 15. BAĞLANTI HAVUZUNU TEMIZLE
-- İşlem başı idle bağlantıları kapat
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
-- 16. VACUUM + ANALYZE — tablo istatistiklerini güncelle
-- ─────────────────────────────────────────────
ANALYZE public.messages;
ANALYZE public.server_members;
ANALYZE public.server_member_roles;
ANALYZE public.notifications;
ANALYZE public.reactions;
ANALYZE public.profiles;
ANALYZE public.channels;
ANALYZE public.server_bots;
