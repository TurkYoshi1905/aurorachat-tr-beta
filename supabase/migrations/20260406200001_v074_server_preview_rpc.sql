-- ============================================================
-- AuroraChat v0.7.4 – Server preview RPC
-- Allows non-members to get member/channel counts for a server
-- without being blocked by RLS policies.
-- ============================================================

CREATE OR REPLACE FUNCTION get_server_preview_counts(p_server_id UUID)
RETURNS TABLE(member_count BIGINT, channel_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM server_members WHERE server_id = p_server_id)::BIGINT AS member_count,
    (SELECT COUNT(*) FROM channels WHERE server_id = p_server_id)::BIGINT AS channel_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_server_preview_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_preview_counts(UUID) TO anon;
