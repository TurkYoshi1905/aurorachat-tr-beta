-- =====================================================================
-- AuroraChat v1.0.4 migration
--
-- Goals:
-- 1) Discord-style mesaj render perf + optimistic UI:
--    `messages` tablosu için REPLICA IDENTITY FULL ve
--    supabase_realtime publication üyeliği garanti altında olsun.
--    DELETE payload'ları full row taşımalı ki ChatArea memberMap
--    cache'inden mesaj çıkarımı doğru çalışsın.
--
-- 2) Tüm rol izinleri tam aktif (send_messages, attach_files,
--    pin_messages, manage_messages):
--    `server_roles` tablosu izin değişikliklerinde anlık yansısın.
--    REPLICA IDENTITY FULL + publication üyeliği belt-and-suspenders.
--
-- 3) Rol rengi anlık yansıma:
--    `server_member_roles` ve `server_roles` realtime kanalları
--    hazır olmalı; `server_members` da publication'a alınıyor ki
--    memberMap rebuild eden Index.tsx aboneliği üyelik değişimlerini
--    de yakalayabilsin (yeni katılan üyenin rol rengi anında görünür).
--
-- 4) LoginBanModal:
--    Login sırasında `account_bans` tablosuna hızlı SELECT için
--    aktif ban index'i zaten var (idx_account_bans_one_active);
--    realtime aboneliği global ban watch'ı için zaten v1.0.3'te
--    açıldı. Burada sadece publication üyeliği belt-and-suspenders
--    olarak yeniden konfirme ediliyor.
--
-- 5) Bildirilerim status realtime:
--    `message_reports` REPLICA IDENTITY FULL + publication
--    yeniden konfirme.
--
-- 6) Kelime Filtresi - Muaf Roller arama:
--    `word_filter_exempt_roles` realtime publication'a alınıyor ki
--    bir admin bir rolü muaf eklediğinde diğer admin'in açık olan
--    ServerSettings ekranı anında güncellensin.
--
-- Bu migration tamamen idempotent — istediğiniz kadar tekrar çalıştırın,
-- hiçbir yan etki yok.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) REPLICA IDENTITY FULL + supabase_realtime publication üyeliği
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'messages',                  -- optimistic UI + DELETE payload
    'direct_messages',           -- DM optimistic UI
    'server_roles',              -- izinler + rol rengi
    'server_member_roles',       -- üye-rol atamaları
    'server_members',            -- üye katılma/ayrılma -> memberMap rebuild
    'account_bans',              -- LoginBanModal + global ban watch
    'message_reports',           -- Bildirilerim status realtime
    'profiles',                  -- avatar/display_name değişikliği realtime
    'word_filter_exempt_roles'   -- ServerSettings Muaf Roller realtime
  ]
  LOOP
    -- Tablo gerçekten var mı kontrol et (ortamlar arası güvenlik)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- REPLICA IDENTITY FULL: DELETE/UPDATE event'leri tam satırı taşısın
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

      -- Publication'a idempotent olarak ekle
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        BEGIN
          EXECUTE format(
            'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
          WHEN others           THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2) Performans: ChatArea memberMap için sıkça çekilen
--    server_members + server_member_roles join'ini hızlandıran indexler.
--    (Idempotent — IF NOT EXISTS ile)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_server_members_server_user
  ON public.server_members(server_id, user_id);

CREATE INDEX IF NOT EXISTS idx_server_member_roles_member
  ON public.server_member_roles(member_id);

CREATE INDEX IF NOT EXISTS idx_server_roles_server_position
  ON public.server_roles(server_id, position DESC);

-- ---------------------------------------------------------------------
-- 3) İzin alanı default değerleri:
--    Eski rol kayıtlarında permissions JSONB'sinde
--    send_messages / attach_files anahtarı yoksa frontend default
--    olarak true kabul ediyor (geriye dönük uyumluluk).
--    Yeni rollerde ise explicit true atayalım ki ServerSettings'te
--    UI'da checkbox doğru görünsün.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'server_roles'
      AND column_name = 'permissions'
  ) THEN
    -- Mevcut rollerde eksik anahtarları tamamla (sadece yoksa ekle)
    UPDATE public.server_roles
    SET permissions = permissions
      || jsonb_build_object('send_messages', true)
    WHERE NOT (permissions ? 'send_messages');

    UPDATE public.server_roles
    SET permissions = permissions
      || jsonb_build_object('attach_files', true)
    WHERE NOT (permissions ? 'attach_files');

    UPDATE public.server_roles
    SET permissions = permissions
      || jsonb_build_object('pin_messages', false)
    WHERE NOT (permissions ? 'pin_messages');

    UPDATE public.server_roles
    SET permissions = permissions
      || jsonb_build_object('manage_messages', false)
    WHERE NOT (permissions ? 'manage_messages');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4) Doğrulama yardımcısı (opsiyonel — sadece geliştirici için):
--    Realtime'a kayıtlı tabloları listelemek için tek satırlık sorgu.
--
--   SELECT schemaname, tablename
--   FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime'
--   ORDER BY tablename;
--
--   Beklenen v1.0.4 listesi:
--   account_bans, direct_messages, message_reports, messages,
--   profiles, server_member_roles, server_members, server_roles,
--   word_filter_exempt_roles, ...
-- ---------------------------------------------------------------------
