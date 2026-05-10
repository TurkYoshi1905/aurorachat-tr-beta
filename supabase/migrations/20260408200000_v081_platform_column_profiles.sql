-- v0.8.1 – profiles tablosuna platform kolonu eklendi (mobil/tablet/masaüstü tespiti için)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'desktop'
    CHECK (platform IN ('mobile', 'tablet', 'desktop', 'unknown'));

-- Authenticated kullanıcılar kendi platform bilgisini güncelleyebilir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own_platform'
  ) THEN
    -- profiles zaten UPDATE policy'si olabilir, sadece sütun eklendi yeterli
    -- Ana UPDATE policy'si varsa bu politikaya gerek yok
    NULL;
  END IF;
END $$;

-- profiles tablosunu realtime'a ekle (zaten ekliydi ama emin olmak için)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
