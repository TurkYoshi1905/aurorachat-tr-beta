-- Server-side trigger to create DM notifications automatically
-- This ensures notifications are saved even when the recipient is offline/not in chat

CREATE OR REPLACE FUNCTION public.handle_new_direct_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver_id UUID;
  v_sender_display TEXT;
BEGIN
  -- Find the other user in the conversation (the receiver)
  SELECT
    CASE WHEN user1_id = NEW.sender_id THEN user2_id ELSE user1_id END
  INTO v_receiver_id
  FROM dm_conversations
  WHERE id = NEW.conversation_id;

  IF v_receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(display_name, username, 'Biri')
  INTO v_sender_display
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Insert notification for the receiver
  INSERT INTO notifications (user_id, type, title, body, data, read)
  VALUES (
    v_receiver_id,
    'dm',
    v_sender_display || ' sana mesaj gönderdi',
    CASE
      WHEN length(NEW.content) > 100 THEN left(NEW.content, 100) || '…'
      ELSE COALESCE(NULLIF(NEW.content, ''), '📎 Dosya')
    END,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    ),
    false
  );

  RETURN NEW;
END;
$$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_direct_message_notification ON public.direct_messages;

CREATE TRIGGER on_direct_message_notification
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_direct_message_notification();

-- Also ensure realtime is enabled for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
