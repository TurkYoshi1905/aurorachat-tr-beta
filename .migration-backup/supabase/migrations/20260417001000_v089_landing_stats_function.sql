-- Stats function for the landing page
-- SECURITY DEFINER: bypasses RLS so anon users can get counts
CREATE OR REPLACE FUNCTION get_landing_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'users',    (SELECT COUNT(*) FROM profiles),
    'messages', (SELECT COUNT(*) FROM messages) + (SELECT COUNT(*) FROM direct_messages),
    'servers',  (SELECT COUNT(*) FROM servers)
  );
$$;

-- Allow both anonymous and authenticated users to call this function
GRANT EXECUTE ON FUNCTION get_landing_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_landing_stats() TO authenticated;
