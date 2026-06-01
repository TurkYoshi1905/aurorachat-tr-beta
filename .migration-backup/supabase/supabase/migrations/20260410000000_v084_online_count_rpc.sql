-- RPC: get_server_online_count
-- Returns the number of online members in a given server.
-- Uses SECURITY DEFINER to bypass RLS on profiles table.
CREATE OR REPLACE FUNCTION get_server_online_count(p_server_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM server_members sm
  JOIN profiles p ON p.id = sm.user_id
  WHERE sm.server_id = p_server_id
    AND p.status = 'online';
$$;

GRANT EXECUTE ON FUNCTION get_server_online_count(uuid) TO authenticated, anon;
