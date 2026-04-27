-- ============================================================
-- AuroraChat v0.7.5 – Realtime publication + DM realtime fix
-- Ensures messages and direct_messages tables are in the
-- supabase_realtime publication so that bot messages (welcome/
-- leave) and DM messages appear in realtime for all clients.
-- ============================================================

-- Ensure messages table is in realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN OTHERS THEN
    -- Already in publication or publication doesn't exist, ignore
    NULL;
  END;
END $$;

-- Ensure direct_messages table is in realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Ensure dm_conversations table is in realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE dm_conversations;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Ensure notifications table is in realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Make sure messages RLS allows server members to see bot messages (user_id IS NULL)
-- Drop old policy if it blocked bot messages, then recreate with bot support
DO $$
BEGIN
  -- Try to drop a known restrictive policy name; ignore if it doesn't exist
  BEGIN
    DROP POLICY IF EXISTS "Server members can read messages" ON messages;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    DROP POLICY IF EXISTS "Users can read messages in their channels" ON messages;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Create an open read policy for messages: server members OR bot messages in their channels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'messages' AND policyname = 'members_can_read_channel_messages_v2'
  ) THEN
    CREATE POLICY members_can_read_channel_messages_v2 ON messages
      FOR SELECT
      USING (
        channel_id IN (
          SELECT c.id FROM channels c
          JOIN server_members sm ON sm.server_id = c.server_id
          WHERE sm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Re-run the welcome/leave trigger setup to ensure clean state
-- Drop all existing variants first
DROP TRIGGER IF EXISTS on_member_join_welcome        ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome      ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v2   ON server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v3   ON server_members;
DROP TRIGGER IF EXISTS trg_welcome_message           ON server_members;
DROP TRIGGER IF EXISTS on_member_leave_message       ON server_members;
DROP TRIGGER IF EXISTS trg_leave_message             ON server_members;

DROP FUNCTION IF EXISTS send_welcome_message();
DROP FUNCTION IF EXISTS handle_welcome_message_v3();
DROP FUNCTION IF EXISTS handle_welcome_message_v4();
DROP FUNCTION IF EXISTS handle_welcome_message_v5();
DROP FUNCTION IF EXISTS handle_leave_message();
DROP FUNCTION IF EXISTS handle_leave_message_v2();

-- WELCOME function v6
CREATE OR REPLACE FUNCTION handle_welcome_message_v6()
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
  RAISE WARNING 'handle_welcome_message_v6 error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_welcome_message_v6();

-- LEAVE function v3
CREATE OR REPLACE FUNCTION handle_leave_message_v3()
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
  RAISE WARNING 'handle_leave_message_v3 error: %', SQLERRM;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_member_leave_message
  BEFORE DELETE ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_message_v3();
