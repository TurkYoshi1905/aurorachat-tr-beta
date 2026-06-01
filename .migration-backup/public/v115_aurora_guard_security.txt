-- v1.1.5 Aurora Guard Security Migration

-- 1. Banned IPs table
CREATE TABLE IF NOT EXISTS public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  banned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  banned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_banned_ips_ip ON public.banned_ips(ip_address) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_banned_ips_user ON public.banned_ips(banned_user_id) WHERE active = true;

ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage banned_ips" ON public.banned_ips;
CREATE POLICY "Admin can manage banned_ips" ON public.banned_ips
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true)
  );

DROP POLICY IF EXISTS "Anyone can check own ip ban" ON public.banned_ips;
CREATE POLICY "Anyone can check own ip ban" ON public.banned_ips
  FOR SELECT TO authenticated
  USING (true);

-- 2. Rate limit violations / cooldown table
CREATE TABLE IF NOT EXISTS public.rate_limit_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_type text NOT NULL DEFAULT 'message_spam',
  cooldown_until timestamptz NOT NULL,
  violation_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cooldowns_user ON public.rate_limit_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_cooldowns_until ON public.rate_limit_cooldowns(cooldown_until);

ALTER TABLE public.rate_limit_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see own cooldowns" ON public.rate_limit_cooldowns;
CREATE POLICY "Users can see own cooldowns" ON public.rate_limit_cooldowns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true));

DROP POLICY IF EXISTS "Admins can manage cooldowns" ON public.rate_limit_cooldowns;
CREATE POLICY "Admins can manage cooldowns" ON public.rate_limit_cooldowns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true));

DROP POLICY IF EXISTS "System can insert cooldowns" ON public.rate_limit_cooldowns;
CREATE POLICY "System can insert cooldowns" ON public.rate_limit_cooldowns
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Mod roles table for hierarchy
CREATE TABLE IF NOT EXISTS public.mod_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mod_role text NOT NULL CHECK (mod_role IN ('yetkili', 'admin', 'moderator', 'deneme_moderator')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mod_roles_user ON public.mod_role_assignments(user_id);

ALTER TABLE public.mod_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view mod roles" ON public.mod_role_assignments;
CREATE POLICY "Anyone can view mod roles" ON public.mod_role_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Founder can manage mod roles" ON public.mod_role_assignments;
CREATE POLICY "Founder can manage mod roles" ON public.mod_role_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'asfurkan140@gmail.com'
    )
  );

-- 4. Fix announcement_comments RLS - allow users to delete their own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON public.announcement_comments;
CREATE POLICY "Users can delete own comments" ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete any comment" ON public.announcement_comments;
CREATE POLICY "Admins can delete any comment" ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true)
  );

-- 5. Enable realtime for new tables
ALTER TABLE public.banned_ips REPLICA IDENTITY FULL;
ALTER TABLE public.rate_limit_cooldowns REPLICA IDENTITY FULL;
ALTER TABLE public.mod_role_assignments REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.banned_ips;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rate_limit_cooldowns;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mod_role_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 6. RPC: lift cooldown (admin only)
CREATE OR REPLACE FUNCTION public.lift_user_cooldown(p_cooldown_id uuid, p_lifted_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_lifted_by AND is_app_admin = true) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.rate_limit_cooldowns
  SET cooldown_until = now() - interval '1 second',
      lifted_by = p_lifted_by,
      lifted_at = now()
  WHERE id = p_cooldown_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lift_user_cooldown TO authenticated;
