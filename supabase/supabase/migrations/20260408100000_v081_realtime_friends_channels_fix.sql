-- v0.8.1 – Realtime: friends + channels tabloları gerçek zamanlı yayına eklendi
-- Sunucu üye listesi mevcut kullanıcı görünürlüğü için server_members REPLICA IDENTITY FULL

-- ────────────────────────────────────────────
-- 1. REPLICA IDENTITY FULL – DELETE event'lerinde eski satır verisi gelsin
-- ────────────────────────────────────────────
ALTER TABLE public.friends         REPLICA IDENTITY FULL;
ALTER TABLE public.channels        REPLICA IDENTITY FULL;
ALTER TABLE public.server_members  REPLICA IDENTITY FULL;
ALTER TABLE public.servers         REPLICA IDENTITY FULL;
ALTER TABLE public.profiles        REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────
-- 2. Supabase Realtime Publication'a tablolar ekleniyor
-- (Zaten ekli ise hata vermemesi için yok-ise-ekle pattern)
-- ────────────────────────────────────────────
DO $$
BEGIN
  -- friends
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friends'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
  END IF;

  -- channels
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  END IF;

  -- server_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
  END IF;

  -- servers
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'servers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
  END IF;

  -- profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- ────────────────────────────────────────────
-- 3. RLS: Authenticated kullanıcılar friends tablosunu okuyabilir
-- ────────────────────────────────────────────
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'friends' AND policyname = 'friends_select_own'
  ) THEN
    CREATE POLICY friends_select_own ON public.friends
      FOR SELECT
      USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'friends' AND policyname = 'friends_insert_own'
  ) THEN
    CREATE POLICY friends_insert_own ON public.friends
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'friends' AND policyname = 'friends_update_own'
  ) THEN
    CREATE POLICY friends_update_own ON public.friends
      FOR UPDATE
      USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'friends' AND policyname = 'friends_delete_own'
  ) THEN
    CREATE POLICY friends_delete_own ON public.friends
      FOR DELETE
      USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;
END $$;
