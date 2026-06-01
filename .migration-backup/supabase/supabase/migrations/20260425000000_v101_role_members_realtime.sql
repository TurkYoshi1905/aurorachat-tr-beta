-- v1.0.1: server_member_roles gerçek zamanlı güncelleme
-- Rol atama/kaldırma işlemleri anında tüm istemcilere yansısın
-- Supabase SQL Editor'da çalıştırın

-- 1. server_member_roles tablosu için REPLICA IDENTITY FULL ayarla
--    (DELETE eventlerinin tam satır verisini taşıması için gerekli)
ALTER TABLE server_member_roles REPLICA IDENTITY FULL;

-- 2. server_member_roles tablosunu realtime yayınına idempotent olarak ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'server_member_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_member_roles;
  END IF;
END $$;

-- 3. server_roles tablosunu da realtime yayınına ekle (rol rengi/adı değişikliklerinin anında yansıması)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'server_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_roles;
  END IF;
END $$;

ALTER TABLE server_roles REPLICA IDENTITY FULL;

-- Not: Bu migration'dan sonra rol atama/kaldırma işlemleri tüm açık
-- istemcilerde (diğer kullanıcılar dahil) anında görünür hale gelir.
-- Supabase Realtime aboneliği: channel.on('postgres_changes', {
--   event: '*', schema: 'public', table: 'server_member_roles'
-- }, callback)
