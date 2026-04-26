-- v0.9.0 hotfix: Moderasyon paneli için güvenilir canlı durum kaynağı
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  browser TEXT NOT NULL DEFAULT 'unknown',
  os TEXT NOT NULL DEFAULT 'unknown',
  ip_address TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, session_key)
);

CREATE OR REPLACE FUNCTION public.is_app_admin_check(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_app_admin FROM public.profiles WHERE id = user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_founder_check(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = user_id
      AND email = 'asfurkan140@gmail.com'
  );
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active_seen
  ON public.user_sessions(user_id, is_active, last_seen DESC);

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete own sessions" ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "App admins can view all sessions" ON public.user_sessions;
CREATE POLICY "App admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_app_admin_check(auth.uid())
    OR public.is_founder_check(auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
  END IF;
END$$;

UPDATE public.profiles
SET status = 'offline'
WHERE last_seen IS NULL
   OR last_seen < now() - interval '2 minutes';