-- v0.7.1 Migration: Leave message columns + improved welcome & leave triggers
-- Run this on your Supabase instance via the SQL Editor

-- 1. Add leave message columns to servers table
ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS leave_enabled   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leave_message   TEXT,
  ADD COLUMN IF NOT EXISTS leave_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL;

-- 2. Improved welcome message function (v3) with better error handling
CREATE OR REPLACE FUNCTION handle_welcome_message_v3()
RETURNS TRIGGER AS $$
DECLARE
  v_server RECORD;
  v_username TEXT;
  v_message TEXT;
BEGIN
  -- Fetch server welcome settings
  SELECT id, name, owner_id, welcome_enabled, welcome_message, welcome_channel_id
    INTO v_server
    FROM servers
   WHERE id = NEW.server_id;

  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT COALESCE(v_server.welcome_enabled, FALSE) THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(TRIM(v_server.welcome_message), '') = '' THEN RETURN NEW; END IF;

  -- Try to get username from profiles
  SELECT NULLIF(TRIM(COALESCE(display_name, username)), '')
    INTO v_username
    FROM profiles
   WHERE id = NEW.user_id;

  -- Fallback: auth.users email prefix
  IF v_username IS NULL THEN
    SELECT NULLIF(SPLIT_PART(email, '@', 1), '')
      INTO v_username
      FROM auth.users
     WHERE id = NEW.user_id;
  END IF;

  -- Final fallback
  v_username := COALESCE(v_username, 'Yeni Üye');

  v_message := REPLACE(v_server.welcome_message, '{user}', '@' || v_username);
  v_message := REPLACE(v_message, '{server}', v_server.name);

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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_welcome_message_v3 error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old welcome trigger and recreate with v3 function
DROP TRIGGER IF EXISTS on_member_join_welcome ON server_members;
DROP TRIGGER IF EXISTS trg_welcome_message ON server_members;
CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_welcome_message_v3();

-- 3. Leave message function
CREATE OR REPLACE FUNCTION handle_leave_message()
RETURNS TRIGGER AS $$
DECLARE
  v_server RECORD;
  v_username TEXT;
  v_message TEXT;
BEGIN
  SELECT id, name, owner_id, leave_enabled, leave_message, leave_channel_id
    INTO v_server
    FROM servers
   WHERE id = OLD.server_id;

  IF NOT FOUND THEN RETURN OLD; END IF;
  IF NOT COALESCE(v_server.leave_enabled, FALSE) THEN RETURN OLD; END IF;
  IF v_server.leave_channel_id IS NULL THEN RETURN OLD; END IF;
  IF COALESCE(TRIM(v_server.leave_message), '') = '' THEN RETURN OLD; END IF;

  SELECT NULLIF(TRIM(COALESCE(display_name, username)), '')
    INTO v_username
    FROM profiles
   WHERE id = OLD.user_id;

  IF v_username IS NULL THEN
    SELECT NULLIF(SPLIT_PART(email, '@', 1), '')
      INTO v_username
      FROM auth.users
     WHERE id = OLD.user_id;
  END IF;

  v_username := COALESCE(v_username, 'Bir Üye');

  v_message := REPLACE(v_server.leave_message, '{user}', '@' || v_username);
  v_message := REPLACE(v_message, '{server}', v_server.name);

  INSERT INTO messages (channel_id, user_id, author_name, content, server_id, inserted_at)
  VALUES (
    v_server.leave_channel_id,
    v_server.owner_id,
    'AuroraChat Bot',
    v_message,
    OLD.server_id,
    NOW()
  );

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_leave_message error: %', SQLERRM;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_member_leave_message ON server_members;
CREATE TRIGGER on_member_leave_message
  BEFORE DELETE ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_message();
