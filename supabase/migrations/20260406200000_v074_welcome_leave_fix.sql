-- ============================================================
-- AuroraChat v0.7.4 – Welcome & Leave trigger full reset
-- Fixes: when member joins, leave message was being sent.
-- Drops ALL triggers on server_members, then re-creates
-- welcome (AFTER INSERT) and leave (BEFORE DELETE) cleanly.
-- ============================================================

-- Drop every known trigger variant on server_members
DROP TRIGGER IF EXISTS on_member_join_welcome        ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome      ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v2   ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v3   ON server_members;
DROP TRIGGER IF EXISTS trg_welcome_message           ON server_members;
DROP TRIGGER IF EXISTS on_member_leave_message       ON server_members;
DROP TRIGGER IF EXISTS trg_leave_message             ON server_members;

-- Drop old function variants
DROP FUNCTION IF EXISTS send_welcome_message();
DROP FUNCTION IF EXISTS handle_welcome_message_v3();
DROP FUNCTION IF EXISTS handle_leave_message();

-- ────────────────────────────────────────────────────────────
-- WELCOME function (fires on INSERT)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_welcome_message_v5()
RETURNS TRIGGER AS $$
DECLARE
  v_server   RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT id, name, owner_id, welcome_enabled, welcome_message, welcome_channel_id
  INTO   v_server
  FROM   servers
  WHERE  id = NEW.server_id;

  IF NOT COALESCE(v_server.welcome_enabled, FALSE)    THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL               THEN RETURN NEW; END IF;
  IF COALESCE(TRIM(v_server.welcome_message), '') = '' THEN RETURN NEW; END IF;

  SELECT COALESCE(
    NULLIF(TRIM(display_name), ''),
    NULLIF(TRIM(username), ''),
    'Kullanıcı'
  )
  INTO v_username
  FROM profiles
  WHERE id = NEW.user_id;

  v_username := COALESCE(v_username, 'Kullanıcı');

  v_message := REPLACE(v_server.welcome_message, '{user}',   '@' || v_username);
  v_message := REPLACE(v_message,                '{server}', COALESCE(v_server.name, ''));

  INSERT INTO messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (
    v_server.welcome_channel_id,
    NULL,
    'AuroraChat Bot',
    TRUE,
    v_message,
    NEW.server_id,
    NOW()
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_welcome_message_v5 error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_welcome_message_v5();

-- ────────────────────────────────────────────────────────────
-- LEAVE function (fires on DELETE)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_leave_message_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_server   RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT id, name, owner_id, leave_enabled, leave_message, leave_channel_id
  INTO   v_server
  FROM   servers
  WHERE  id = OLD.server_id;

  IF NOT COALESCE(v_server.leave_enabled, FALSE)      THEN RETURN OLD; END IF;
  IF v_server.leave_channel_id IS NULL                 THEN RETURN OLD; END IF;
  IF COALESCE(TRIM(v_server.leave_message), '') = ''   THEN RETURN OLD; END IF;

  SELECT COALESCE(
    NULLIF(TRIM(display_name), ''),
    NULLIF(TRIM(username), ''),
    'Bir Üye'
  )
  INTO v_username
  FROM profiles
  WHERE id = OLD.user_id;

  v_username := COALESCE(v_username, 'Bir Üye');

  v_message := REPLACE(v_server.leave_message, '{user}',   '@' || v_username);
  v_message := REPLACE(v_message,              '{server}', COALESCE(v_server.name, ''));

  INSERT INTO messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (
    v_server.leave_channel_id,
    NULL,
    'AuroraChat Bot',
    TRUE,
    v_message,
    OLD.server_id,
    NOW()
  );

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_leave_message_v2 error: %', SQLERRM;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_member_leave_message
  BEFORE DELETE ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_message_v2();
