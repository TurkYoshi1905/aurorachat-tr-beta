-- ============================================================
-- AuroraChat v0.8.0
-- 1. voice_channel_members tablosu (gerçek zamanlı ses katılımcıları)
-- 2. Premium iptalinde Basic rozetini de temizleyen trigger
-- ============================================================

-- ---------------------------------------------------------------
-- 1. voice_channel_members tablosu
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_channel_members (
  channel_id  TEXT        NOT NULL,
  server_id   UUID        REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT       NOT NULL DEFAULT '',
  avatar_url  TEXT,
  mic_muted   BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- RLS aç
ALTER TABLE public.voice_channel_members ENABLE ROW LEVEL SECURITY;

-- Tüm kimliği doğrulanmış kullanıcılar okuyabilir
DROP POLICY IF EXISTS "Anyone authenticated can view voice members" ON public.voice_channel_members;
CREATE POLICY "Anyone authenticated can view voice members"
  ON public.voice_channel_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Kullanıcı kendi satırını ekleyebilir/güncelleyebilir
DROP POLICY IF EXISTS "Users can upsert own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can upsert own voice member row"
  ON public.voice_channel_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can update own voice member row"
  ON public.voice_channel_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi satırını silebilir
DROP POLICY IF EXISTS "Users can delete own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can delete own voice member row"
  ON public.voice_channel_members FOR DELETE
  USING (auth.uid() = user_id);

-- Supabase Realtime yayınına ekle
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_channel_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Realtime için tam satır verisi
ALTER TABLE public.voice_channel_members REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- 2. Premium iptalinde Basic rozetini otomatik temizle (trigger)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_clear_basic_on_premium_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- is_premium FALSE yapıldıysa has_basic_badge ve basic_expires_at da temizle
  IF OLD.is_premium = TRUE AND NEW.is_premium = FALSE THEN
    NEW.has_basic_badge   := FALSE;
    NEW.basic_expires_at  := NULL;
    NEW.has_premium_badge := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_basic_on_premium_cancel ON public.profiles;
CREATE TRIGGER trg_clear_basic_on_premium_cancel
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clear_basic_on_premium_cancel();

-- ---------------------------------------------------------------
-- 3. Eski kalmış ses kayıtlarını sunucu başlangıcında temizle
--    (Kullanıcı sekmeyi kapattığında satır kalabilir)
-- ---------------------------------------------------------------
-- Sunucu yeniden başlatıldığında veya broadcast kanalı temizlendiğinde
-- elle tetiklenebilecek yardımcı fonksiyon:
CREATE OR REPLACE FUNCTION public.fn_clear_voice_member(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.voice_channel_members WHERE user_id = p_user_id;
END;
$$;

-- Authenticated kullanıcılar yalnızca kendi kaydını silebilmeli
REVOKE ALL ON FUNCTION public.fn_clear_voice_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_clear_voice_member(UUID) TO authenticated;
