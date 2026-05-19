-- v1.2.1: Community feature + Bot API auth + Online presence improvements

-- 1. Add is_community column to servers (public discovery)
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_community boolean NOT NULL DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS community_description text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS community_category text;

-- 2. Index for community discovery queries
CREATE INDEX IF NOT EXISTS idx_servers_is_community ON servers(is_community) WHERE is_community = true;

-- 3. Bot API tokens table (for GET /api/v1/bot/me auth)
CREATE TABLE IF NOT EXISTS bot_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE bot_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Bot owner can manage tokens"
  ON bot_api_tokens FOR ALL
  USING (
    bot_id IN (SELECT id FROM bots WHERE creator_id = auth.uid())
  );

-- 4. RLS policy for servers: allow reading community servers without auth
DROP POLICY IF EXISTS "Community servers are publicly readable" ON servers;
CREATE POLICY "Community servers are publicly readable"
  ON servers FOR SELECT
  USING (is_community = true OR auth.uid() IS NOT NULL);

-- 5. Function to get public community servers with member count
CREATE OR REPLACE FUNCTION get_community_servers(
  p_search text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  community_description text,
  community_category text,
  icon_url text,
  member_count bigint,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    s.id,
    s.name,
    s.description,
    s.community_description,
    s.community_category,
    s.icon_url,
    COUNT(sm.id) AS member_count,
    s.created_at
  FROM servers s
  LEFT JOIN server_members sm ON sm.server_id = s.id
  WHERE
    s.is_community = true
    AND (p_search IS NULL OR s.name ILIKE '%' || p_search || '%' OR s.community_description ILIKE '%' || p_search || '%')
    AND (p_category IS NULL OR s.community_category = p_category)
  GROUP BY s.id
  ORDER BY member_count DESC, s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 6. Function to validate bot API token (used by Edge Function or frontend RPC)
CREATE OR REPLACE FUNCTION validate_bot_token(p_token text)
RETURNS TABLE (
  bot_id uuid,
  bot_name text,
  bot_username text,
  creator_id uuid,
  is_public boolean,
  avatar_url text,
  commands jsonb,
  server_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bot_api_tokens SET last_used_at = now() WHERE token = p_token;
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.username,
    b.creator_id,
    b.is_public,
    b.avatar_url,
    b.commands,
    (SELECT COUNT(*) FROM server_bots sb WHERE sb.bot_id = b.id) AS server_count
  FROM bots b
  WHERE b.id = (SELECT bat.bot_id FROM bot_api_tokens bat WHERE bat.token = p_token LIMIT 1);
END;
$$;
