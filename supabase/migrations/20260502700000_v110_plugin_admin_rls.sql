-- v1.1.0: Admin plugin approval RLS + admin flag for app owner
-- Allows the app owner (is_app_admin = true) to approve/reject any plugin.

-- ── 1. Ensure app owner has is_app_admin = true ─────────────────
-- Set the flag by email (one-time idempotent operation).
UPDATE public.profiles
SET is_app_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'asfurkan140@gmail.com'
);

-- ── 2. RLS policy: admin can read ALL plugins (including pending) ─
DROP POLICY IF EXISTS "Admins can view all plugins" ON public.plugins;
CREATE POLICY "Admins can view all plugins" ON public.plugins
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  );

-- ── 3. RLS policy: admin can update any plugin (approve/reject) ──
DROP POLICY IF EXISTS "Admins can update any plugin" ON public.plugins;
CREATE POLICY "Admins can update any plugin" ON public.plugins
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  );

-- ── 4. RLS policy: admin can delete any plugin ───────────────────
DROP POLICY IF EXISTS "Admins can delete any plugin" ON public.plugins;
CREATE POLICY "Admins can delete any plugin" ON public.plugins
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  );
