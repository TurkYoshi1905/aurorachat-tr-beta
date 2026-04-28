-- v0.8.8: Message Reports & App Admin system
-- Run this in Supabase SQL Editor

-- 1. Add is_app_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_app_admin boolean DEFAULT false;

-- 2. Set founder as app admin by email
UPDATE public.profiles
SET is_app_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'asfurkan140@gmail.com'
);

-- 3. Create a SECURITY DEFINER helper function to check admin status
--    This avoids infinite recursion in RLS policies that query profiles.
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

-- 4. Create message_reports table
CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id TEXT NOT NULL,
  message_content TEXT,
  channel_id TEXT,
  server_id TEXT,
  dm_conversation_id TEXT,
  report_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolver_note TEXT
);

-- 5. Enable RLS on message_reports
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for message_reports
DROP POLICY IF EXISTS "Users can create reports" ON public.message_reports;
CREATE POLICY "Users can create reports" ON public.message_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "App admins can view all reports" ON public.message_reports;
CREATE POLICY "App admins can view all reports" ON public.message_reports
  FOR SELECT USING (
    public.is_app_admin_check(auth.uid())
  );

DROP POLICY IF EXISTS "Reporters can view own reports" ON public.message_reports;
CREATE POLICY "Reporters can view own reports" ON public.message_reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "App admins can update reports" ON public.message_reports;
CREATE POLICY "App admins can update reports" ON public.message_reports
  FOR UPDATE USING (
    public.is_app_admin_check(auth.uid())
  );

-- 7. Safe profiles policies using the security definer function
--    (avoids infinite recursion from nested profiles subquery)
DROP POLICY IF EXISTS "App admins can view all profiles" ON public.profiles;
CREATE POLICY "App admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_app_admin_check(auth.uid())
  );

DROP POLICY IF EXISTS "App admins can update profiles" ON public.profiles;
CREATE POLICY "App admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.is_app_admin_check(auth.uid())
  );

-- 8. Enable Realtime for message_reports
ALTER TABLE public.message_reports REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
  END IF;
END$$;

-- 9. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON public.message_reports(status);
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter ON public.message_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_created ON public.message_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_app_admin ON public.profiles(is_app_admin) WHERE is_app_admin = true;
