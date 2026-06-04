-- v1.2.9: voice-notes Storage bucket RLS politikaları
-- Kimliği doğrulanmış kullanıcıların kendi ses notlarını yüklemesine,
-- herkese okumasına ve kendi kayıtlarını silmesine izin verir.

-- Bucket varsa güncelle (public = false, file_size_limit = 10MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  10485760,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eski politikaları temizle
DROP POLICY IF EXISTS "voice_notes_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own voice notes" ON storage.objects;

-- INSERT: Giriş yapmış kullanıcılar kendi klasörüne yükleyebilir
CREATE POLICY "voice_notes_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Giriş yapmış herkes okuyabilir (DM ve kanal sesli notlar için)
CREATE POLICY "voice_notes_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'voice-notes');

-- DELETE: Sadece kendi yüklediği dosyayı silebilir
CREATE POLICY "voice_notes_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Profil yüklemeleri için ek güvence: service role her şeyi yapabilir
CREATE POLICY "voice_notes_service_all" ON storage.objects
FOR ALL TO service_role USING (bucket_id = 'voice-notes');
