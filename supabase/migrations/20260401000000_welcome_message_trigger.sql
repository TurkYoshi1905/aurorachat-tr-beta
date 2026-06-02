-- Welcome Message Trigger
-- Yeni bir üye sunucuya katıldığında, sunucu ayarlarında belirlenmiş kanala
-- otomatik hoş geldin mesajı gönderir.

CREATE OR REPLACE FUNCTION send_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  v_server RECORD;
  v_username TEXT;
  v_message TEXT;
  v_bot_id UUID;
BEGIN
  -- Sunucu ayarlarını oku
  SELECT s.welcome_enabled, s.welcome_channel_id, s.welcome_message, s.owner_id
  INTO v_server
  FROM servers s
  WHERE s.id = NEW.server_id;

  -- Hoş geldin mesajı aktif değilse veya kanal seçilmemişse çık
  IF v_server.welcome_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_server.welcome_channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Yeni üyenin kullanıcı adını al
  SELECT COALESCE(display_name, username, 'Kullanıcı')
  INTO v_username
  FROM profiles
  WHERE id = NEW.user_id;

  -- Mesaj şablonunu uygula
  v_message := COALESCE(v_server.welcome_message, 'Hoş geldin {user}! 🎉');
  v_message := REPLACE(v_message, '{user}', '@' || v_username);

  -- Sunucu sahibi adına mesajı gönder (bot gibi davran)
  v_bot_id := v_server.owner_id;

  INSERT INTO messages (channel_id, user_id, content, inserted_at)
  VALUES (v_server.welcome_channel_id, v_bot_id, v_message, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Varsa eski trigger'ı kaldır
DROP TRIGGER IF EXISTS on_member_joined_welcome ON server_members;

-- Yeni trigger oluştur
CREATE TRIGGER on_member_joined_welcome
  AFTER INSERT ON server_members
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_message();
