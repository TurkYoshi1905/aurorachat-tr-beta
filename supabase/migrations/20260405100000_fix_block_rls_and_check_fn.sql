-- v0.7.1 Fix: Allow users to check if they are blocked + helper RPC

-- 1. Add RLS SELECT policy so a user can see records where they are the blocked_id
--    (This lets B detect that A has blocked them)
DROP POLICY IF EXISTS "Users can see blocks where they are blocked" ON public.blocked_users;
CREATE POLICY "Users can see blocks where they are blocked"
  ON public.blocked_users
  FOR SELECT
  TO authenticated
  USING (blocked_id = auth.uid() OR blocker_id = auth.uid());

-- 2. Helper RPC: is_blocked_by(p_blocker_id) RETURNS BOOLEAN
--    Returns TRUE if p_blocker_id has blocked auth.uid()
--    Uses SECURITY DEFINER so it always bypasses RLS for this check
CREATE OR REPLACE FUNCTION is_blocked_by(p_blocker_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_blocker_id
      AND blocked_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_blocked_by(UUID) TO authenticated;
