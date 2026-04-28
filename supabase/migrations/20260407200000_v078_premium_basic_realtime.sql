-- ============================================================
-- AuroraChat v0.7.8 – Premium/Basic üyelik + profiles realtime
-- ============================================================

-- 1. profiles tablosuna yeni sütunlar ekle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_basic_badge BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- has_premium_badge zaten varsa yoksay
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_premium_badge BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. profiles tablosunu Supabase Realtime yayınına ekle
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. REPLICA IDENTITY FULL — realtime için tam satır verisi
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 4. RLS: kullanıcı kendi profilini güncelleyebilmeli (has_basic_badge, basic_expires_at vs.)
--    Mevcut update policy varsa kaldır, yoksa oluştur
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Mevcut is_premium sütunu zaten varsa yoksay
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;
