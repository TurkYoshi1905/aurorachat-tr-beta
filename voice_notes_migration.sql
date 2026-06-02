-- ═══════════════════════════════════════════════════════════════════════════════
--  AuroraChat v1.2.8 — Voice Notes Storage Migration
--  ───────────────────────────────────────────────────────────────────────────
--  Supabase SQL Editor'da bir kez çalıştırın (Dashboard → SQL Editor → Run).
--  PostgreSQL 13+ uyumlu. PL/pgSQL DO bloğu ile idempotent (tekrar çalıştırılabilir).
--
--  Bu dosya:
--    1) voice-notes storage bucket'ını oluşturur (public, 10 MB limit)
--    2) Realtime erişim için RLS politikalarını ayarlar
--    3) Konfigürasyon doğrulama sorgusu çalıştırır
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. voice-notes bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  10485760,   -- 10 MB
  ARRAY[
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mpeg',
    'audio/wav'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── 2. RLS politikaları (PG13 uyumlu DO bloğu) ────────────────────────────
DO $$
BEGIN

  -- Yükleme: oturum açmış her kullanıcı kendi klasörüne ses yükleyebilir
  DROP POLICY IF EXISTS "voice_notes_insert" ON storage.objects;
  CREATE POLICY "voice_notes_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'voice-notes');

  -- Okuma: bucket public olduğu için herkese açık
  DROP POLICY IF EXISTS "voice_notes_select" ON storage.objects;
  CREATE POLICY "voice_notes_select"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'voice-notes');

  -- Silme: yalnızca dosyanın sahibi silebilir (yol: {user_id}/voice_*.webm)
  DROP POLICY IF EXISTS "voice_notes_delete" ON storage.objects;
  CREATE POLICY "voice_notes_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'voice-notes'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

END $$;


-- ─── 3. Konfigürasyon doğrulama ─────────────────────────────────────────────
-- Aşağıdaki sorgu başarıyla çalışırsa kurulum tamamdır.
SELECT
  b.id                                           AS bucket_id,
  b.public                                       AS is_public,
  pg_size_pretty(b.file_size_limit::bigint)     AS max_file_size,
  array_length(b.allowed_mime_types, 1)         AS allowed_mime_count,
  COUNT(p.policyname)                            AS rls_policy_count
FROM storage.buckets b
LEFT JOIN pg_policies p
  ON p.tablename = 'objects'
  AND p.schemaname = 'storage'
  AND p.policyname LIKE 'voice_notes_%'
WHERE b.id = 'voice-notes'
GROUP BY b.id, b.public, b.file_size_limit, b.allowed_mime_types;

-- ─── Beklenen çıktı ─────────────────────────────────────────────────────────
--  bucket_id   | is_public | max_file_size | allowed_mime_count | rls_policy_count
--  voice-notes | true      | 10 MB         | 7                  | 3
-- ════════════════════════════════════════════════════════════════════════════════
--
--  Sesli mesaj depolama formatı (şema değişikliği gerekmez):
--    messages.content = '{"__vn":1,"url":"https://...supabase.../voice-notes/...","dur":42}'
--  parseVoiceNote(content) → VoicePlayerCard ile render edilir.
-- ════════════════════════════════════════════════════════════════════════════════
