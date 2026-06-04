-- v1.2.9 FIX: voice-notes Storage bucket RLS düzeltmesi
-- Sorun 1: Bucket public:false idi → getPublicUrl çalışmıyor
-- Sorun 2: INSERT politikası path kısıtlamalıydı → 403 veriyor
-- Çözüm: Bucket public yapıldı, INSERT herhangi bir authenticated kullanıcıya açıldı

-- ── Eski politikaları temizle ──────────────────────────────────────────────
DROP POLICY IF EXISTS "voice_notes_insert"       ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_select"       ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_delete"       ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_service_all"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read voice notes"                ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own voice notes"           ON storage.objects;

-- ── Bucket'ı güncelle: PUBLIC yapıyoruz (getPublicUrl için zorunlu) ────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  10485760,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac']
)
ON CONFLICT (id) DO UPDATE SET
  public              = true,
  file_size_limit     = EXCLUDED.file_size_limit,
  allowed_mime_types  = EXCLUDED.allowed_mime_types;

-- ── INSERT: Giriş yapmış herhangi bir kullanıcı yükleyebilir ──────────────
-- (Path kısıtlaması kaldırıldı — 403'ün asıl sebebiydi)
CREATE POLICY "voice_notes_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-notes');

-- ── SELECT: Bucket public olduğu için herkese açık ────────────────────────
CREATE POLICY "voice_notes_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'voice-notes');

-- ── DELETE: Sadece dosyayı yükleyen kullanıcı silebilir ──────────────────
CREATE POLICY "voice_notes_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
