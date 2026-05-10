-- ============================================================
-- AuroraChat v0.7.0 – Welcome Message Trigger Fix
-- ============================================================
-- Bu SQL'i Supabase Studio > SQL Editor'de çalıştırın.
-- Tetikleyici fonksiyonu {user} şablonunu doğru kullanıcı adıyla değiştirir.
-- Eğer profil bulunamazsa 'Kullanıcı' fallback değeri kullanılır.

CREATE OR REPLACE FUNCTION send_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  v_server   RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT s.welcome_enabled, s.welcome_channel_id, s.welcome_message, s.owner_id
  INTO   v_server
  FROM   servers s
  WHERE  s.id = NEW.server_id;

  IF v_server.welcome_enabled IS NOT TRUE THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL   THEN RETURN NEW; END IF;

  -- Fetch display_name or username from profiles (with fallback)
  SELECT COALESCE(
    NULLIF(TRIM(display_name), ''),
    NULLIF(TRIM(username), ''),
    'Kullanıcı'
  )
  INTO   v_username
  FROM   profiles
  WHERE  id = NEW.user_id;

  -- If the profile row does not exist yet (race condition), use fallback
  IF v_username IS NULL THEN
    v_username := 'Kullanıcı';
  END IF;

  v_message := COALESCE(NULLIF(TRIM(v_server.welcome_message), ''), 'Hoş geldin {user}! 🎉');
  v_message := REPLACE(v_message, '{user}',   '@' || v_username);
  v_message := REPLACE(v_message, '{server}', COALESCE((SELECT name FROM servers WHERE id = NEW.server_id), ''));

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

-- Re-create trigger to ensure it points to the updated function
DROP TRIGGER IF EXISTS on_member_joined_welcome ON server_members;
CREATE TRIGGER on_member_joined_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW EXECUTE FUNCTION send_welcome_message();
