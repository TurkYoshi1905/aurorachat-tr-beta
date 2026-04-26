-- v0.9.0: Account bans, realtime moderation users list, and profile realtime safety
-- Run this in Supabase SQL Editor after previous migrations.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_app_admin boolean DEFAULT false;

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

CREATE TABLE IF NOT EXISTS public.account_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banned_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  banned_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_bans_one_active
  ON public.account_bans(banned_user_id)
  WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_account_bans_user_active ON public.account_bans(banned_user_id, active);
CREATE INDEX IF NOT EXISTS idx_profiles_username_az ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

ALTER TABLE public.account_bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own active account ban" ON public.account_bans;
CREATE POLICY "Users can view own active account ban" ON public.account_bans
  FOR SELECT USING (auth.uid() = banned_user_id);

DROP POLICY IF EXISTS "App admins can view account bans" ON public.account_bans;
CREATE POLICY "App admins can view account bans" ON public.account_bans
  FOR SELECT USING (public.is_app_admin_check(auth.uid()) OR public.is_founder_check(auth.uid()));

DROP POLICY IF EXISTS "Founder can create account bans" ON public.account_bans;
CREATE POLICY "Founder can create account bans" ON public.account_bans
  FOR INSERT WITH CHECK (public.is_founder_check(auth.uid()));

DROP POLICY IF EXISTS "Founder can update account bans" ON public.account_bans;
CREATE POLICY "Founder can update account bans" ON public.account_bans
  FOR UPDATE USING (public.is_founder_check(auth.uid()))
  WITH CHECK (public.is_founder_check(auth.uid()));

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.account_bans REPLICA IDENTITY FULL;

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
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'account_bans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.account_bans;
  END IF;
END$$;

UPDATE public.profiles
SET is_app_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'asfurkan140@gmail.com'
);
