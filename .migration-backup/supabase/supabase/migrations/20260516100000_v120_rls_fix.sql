-- v1.2.0 RLS Fix: Resolve "permission denied for table users" (42501)
-- This error occurs when RLS policies or application code reference auth.users
-- without the required grants. Mod role assignment functions are the primary trigger.

-- ════════════════════════════════════════════════════════════
-- 1. Grant SELECT on auth.users to authenticated role
--    Allows RLS policies and RPCs to check auth.users safely.
-- ════════════════════════════════════════════════════════════
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO service_role;

-- ════════════════════════════════════════════════════════════
-- 2. Create a SECURITY DEFINER helper to get a user's email
--    without exposing the full auth.users table to the client.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id UUID)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = p_user_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 3. Ensure mod_role_assignments policies don't block mod users
-- ════════════════════════════════════════════════════════════

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Anyone can view mod roles" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Founder can manage mod roles" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Anyone can read mod_role_assignments" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can manage mod_role_assignments" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can manage mod roles" ON public.mod_role_assignments;

-- SELECT: any authenticated user can read mod roles (needed for canAccess checks)
CREATE POLICY "mod_role_assignments_select"
  ON public.mod_role_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: only app admins (founders) can manage mod roles
CREATE POLICY "mod_role_assignments_insert"
  ON public.mod_role_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_app_admin = true
    )
  );

CREATE POLICY "mod_role_assignments_update"
  ON public.mod_role_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_app_admin = true
    )
  );

CREATE POLICY "mod_role_assignments_delete"
  ON public.mod_role_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_app_admin = true
    )
  );

-- ════════════════════════════════════════════════════════════
-- 4. Ensure profiles table allows admin-level updates
--    (needed by ModerationPage to update user profiles)
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_app_admin = true
    )
  );

-- ════════════════════════════════════════════════════════════
-- 5. Ensure banned_ips is accessible for Aurora Guard
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can manage banned_ips" ON public.banned_ips;
CREATE POLICY "Admins can manage banned_ips"
  ON public.banned_ips
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_app_admin = true
    )
  );

-- Allow all authenticated users to read banned_ips for Aurora Guard check
DROP POLICY IF EXISTS "Anyone can read banned_ips" ON public.banned_ips;
CREATE POLICY "Anyone can read banned_ips"
  ON public.banned_ips
  FOR SELECT
  TO authenticated
  USING (true);
