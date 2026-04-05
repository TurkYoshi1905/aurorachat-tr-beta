-- ============================================================
-- AuroraChat v0.7.2 – Welcome message trigger fix
-- ============================================================
-- Sorun: Birden fazla trigger adı nedeniyle çift mesaj gönderiliyordu.
--   - on_member_joined_welcome  (20260402 migration, 'd' var)
--   - on_member_join_welcome    (20260405 migration, 'd' yok)
-- Her ikisi de server_members INSERT'te tetikleniyordu.
-- Bu migration tüm eski varyantları silip tek temiz trigger kurar.
-- Frontend kodu artık karışmıyor; yalnızca bu trigger gönderir.
-- ============================================================

-- 1. Drop ALL old trigger variants (all possible names used historically)
DROP TRIGGER IF EXISTS on_member_joined_welcome    ON server_members;
DROP TRIGGER IF EXISTS on_member_join_welcome      ON server_members;
DROP TRIGGER IF EXISTS trg_welcome_message         ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v2 ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v3 ON server_members;

-- 2. Drop old function variants
DROP FUNCTION IF EXISTS send_welcome_message();
DROP FUNCTION IF EXISTS handle_welcome_message_v3();

-- 3. Create clean v4 function
--    - is_bot = true (so the client renders it as a bot message)
--    - user_id = NULL (bot messages have no real author)
--    - Handles race condition: uses COALESCE with multiple fallbacks
--    - Handles NULL profile (new user whose profile row may not exist yet)
CREATE OR REPLACE FUNCTION handle_welcome_message_v4()
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

  IF NOT COALESCE(v_server.welcome_enabled, FALSE) THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL              THEN RETURN NEW; END IF;
  IF COALESCE(TRIM(v_server.welcome_message), '') = '' THEN RETURN NEW; END IF;

  -- Fetch display name or username; fallback if profile not yet committed
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
  RAISE WARNING 'handle_welcome_message_v4 error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create single canonical trigger
CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_welcome_message_v4();
