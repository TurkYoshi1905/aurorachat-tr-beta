-- ─────────────────────────────────────────────────────────────────────────────
--  AuroraChat v1.2.8 — Voice Notes Migration
--  Supabase SQL Editor'da bir kez çalıştırın.
--  Bu dosya: voice-notes storage bucket'ı oluşturur ve RLS politikalarını ayarlar.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. voice-notes storage bucket'ı oluştur (public, 10 MB limit, sadece ses formatları)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  10485760,
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/ogg;codecs=opus']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: oturum açmış kullanıcılar ses dosyası yükleyebilir
CREATE POLICY IF NOT EXISTS "voice_notes_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

-- 3. RLS: herkese public okuma izni (bucket zaten public)
CREATE POLICY IF NOT EXISTS "voice_notes_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-notes');

-- 4. RLS: dosyanın sahibi silebilir (yol ilk segmenti user_id)
CREATE POLICY IF NOT EXISTS "voice_notes_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
--  Sesli mesajlar, mevcut messages / direct_messages / group_dm_messages
--  tablolarının `content` alanında JSON olarak saklanır:
--    {"__vn":1,"url":"https://...supabase.../voice-notes/...","dur":42}
--  Şema değişikliği gerekmez.
-- ─────────────────────────────────────────────────────────────────────────────
