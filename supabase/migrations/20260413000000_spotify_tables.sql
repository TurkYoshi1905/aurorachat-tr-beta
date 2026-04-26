-- =============================================
-- Spotify Entegrasyon Tabloları
-- spotify_connections: token ve kullanıcı bilgisi
-- spotify_now_playing: anlık müzik durumu
-- =============================================

-- ─── spotify_connections ─────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_connections (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_user_id      TEXT        NOT NULL DEFAULT '',
  spotify_display_name TEXT        NOT NULL DEFAULT '',
  spotify_email        TEXT        NOT NULL DEFAULT '',
  access_token         TEXT        NOT NULL DEFAULT '',
  refresh_token        TEXT        NOT NULL DEFAULT '',
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spotify_connections ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi bağlantısını okuyabilir
DROP POLICY IF EXISTS "spotify_connections_select_own" ON public.spotify_connections;
CREATE POLICY "spotify_connections_select_own"
  ON public.spotify_connections FOR SELECT
  USING (auth.uid() = user_id);

-- Tablo üzerindeki tüm INSERT/UPDATE/DELETE işlemleri
-- service_role (Edge Function) tarafından yapılır.
-- Kullanıcılar doğrudan yazamaz.

-- ─── spotify_now_playing ─────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_now_playing (
  user_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_playing    BOOLEAN     NOT NULL DEFAULT false,
  track_name    TEXT,
  artist_name   TEXT,
  album_name    TEXT,
  album_art_url TEXT,
  track_url     TEXT,
  progress_ms   INTEGER     NOT NULL DEFAULT 0,
  duration_ms   INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spotify_now_playing ENABLE ROW LEVEL SECURITY;

-- Giriş yapmış tüm kullanıcılar anlık müzik durumunu görebilir (profil kartı için)
DROP POLICY IF EXISTS "spotify_now_playing_select_authenticated" ON public.spotify_now_playing;
CREATE POLICY "spotify_now_playing_select_authenticated"
  ON public.spotify_now_playing FOR SELECT
  TO authenticated
  USING (true);

-- ─── Realtime ─────────────────────────────────
-- spotify_now_playing için Realtime etkinleştir
ALTER TABLE public.spotify_now_playing REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'spotify_now_playing'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spotify_now_playing;
  END IF;
END $$;

-- spotify_connections için de Realtime (Settings sayfası için)
ALTER TABLE public.spotify_connections REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'spotify_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spotify_connections;
  END IF;
END $$;

-- ─── profiles tablosuna spotify alanları ──────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spotify_display_name TEXT,
  ADD COLUMN IF NOT EXISTS spotify_avatar_url   TEXT;
