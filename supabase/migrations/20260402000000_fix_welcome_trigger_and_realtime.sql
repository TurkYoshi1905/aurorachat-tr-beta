-- ============================================================
-- AuroraChat v0.6.8 – Realtime + Bot Welcome + Public Count
-- ============================================================

-- ── 1. REPLICA IDENTITY FULL ────────────────────────────────
-- Required so DELETE events include old row data.
-- Without this, server_id filters on DELETE subscriptions
-- silently fail (no match = no event fired).
ALTER TABLE server_members      REPLICA IDENTITY FULL;
ALTER TABLE server_member_roles REPLICA IDENTITY FULL;
ALTER TABLE server_roles        REPLICA IDENTITY FULL;

-- ── 2. Add tables to Supabase Realtime publication ──────────
-- Needed for Postgres Changes subscriptions to fire at all.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE server_members;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE server_member_roles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE server_roles;        EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── 3. Public member-count function (bypasses RLS) ──────────
-- server_members has RLS so non-members cannot SELECT rows.
-- This SECURITY DEFINER function lets anyone get the count
-- (invite embeds, public server previews, etc.).
CREATE OR REPLACE FUNCTION get_server_member_count(p_server_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM server_members WHERE server_id = p_server_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_server_member_count(UUID) TO anon, authenticated;

-- ── 4. Fix welcome-message trigger ──────────────────────────
-- Old trigger sent message as the server owner (no author_name).
-- New version sends as 'AuroraChat Bot' with proper template.
CREATE OR REPLACE FUNCTION send_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  v_server  RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT s.welcome_enabled, s.welcome_channel_id, s.welcome_message, s.owner_id
  INTO   v_server
  FROM   servers s
  WHERE  s.id = NEW.server_id;

  IF v_server.welcome_enabled IS NOT TRUE THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL   THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(username), ''), 'Kullanıcı')
  INTO   v_username
  FROM   profiles
  WHERE  id = NEW.user_id;

  v_username := COALESCE(v_username, 'Kullanıcı');
  v_message  := COALESCE(NULLIF(TRIM(v_server.welcome_message), ''), 'Hoş geldin {user}! 🎉');
  v_message  := REPLACE(v_message, '{user}',   '@' || v_username);
  v_message  := REPLACE(v_message, '{server}', COALESCE((SELECT name FROM servers WHERE id = NEW.server_id), ''));

  INSERT INTO messages (channel_id, user_id, author_name, content, server_id, inserted_at)
  VALUES (
    v_server.welcome_channel_id,
    v_server.owner_id,
    'AuroraChat Bot',
    v_message,
    NEW.server_id,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_member_joined_welcome ON server_members;
CREATE TRIGGER on_member_joined_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW EXECUTE FUNCTION send_welcome_message();
