-- v1.0.9: Mention push notifications + @mention popup in Group DM
--
-- FRONTEND (no SQL needed):
--   GroupDMChatArea: typing @ in the message box now opens a MentionPopup
--   that lists group members. Selecting a member inserts @Name into the
--   textarea, replacing the partial @query already typed.
--   (Same popup already existed in the server ChatArea.)
--
-- BACKEND (this file):
--   When a message containing @username is inserted into `messages` or
--   `group_dm_messages`, a DB trigger parses the mentions, looks up the
--   mentioned user's ID, and inserts a notification row.
--   The existing `on_notification_send_push` trigger then fires automatically,
--   delivering the push both in-app and when the app is in the background.

-- ─────────────────────────────────────────────────────────────
-- 1. Profiles realtime publication (for group member status fix)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- group_dm_members realtime (already may exist from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_dm_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_dm_members;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Index for fast status lookups
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ─────────────────────────────────────────────────────────────
-- 3. Mention notification function for server messages
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_message_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_mention TEXT;
  mention_clean TEXT;
  mentioned_uid UUID;
  sender_name TEXT;
BEGIN
  -- Only process messages with @
  IF NEW.content NOT LIKE '%@%' THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(display_name, username, 'Kullanıcı')
    INTO sender_name
    FROM public.profiles
   WHERE id = NEW.user_id
   LIMIT 1;

  -- Extract each @mention token
  FOR raw_mention IN
    SELECT (regexp_matches(NEW.content, '@([A-Za-z0-9_\u00C0-\u017E]+)', 'g'))[1]
  LOOP
    mention_clean := raw_mention;

    -- Match by username or display_name (case-insensitive)
    SELECT id INTO mentioned_uid
      FROM public.profiles
     WHERE lower(username) = lower(mention_clean)
        OR lower(display_name) = lower(mention_clean)
     LIMIT 1;

    IF mentioned_uid IS NOT NULL AND mentioned_uid <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        mentioned_uid,
        'mention',
        sender_name || ' seni etiketledi',
        NEW.content,
        jsonb_build_object(
          'channel_id', NEW.channel_id,
          'server_id',  NEW.server_id,
          'message_id', NEW.id
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_mention ON public.messages;
CREATE TRIGGER on_message_mention
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.content LIKE '%@%')
  EXECUTE FUNCTION notify_message_mentions();

-- ─────────────────────────────────────────────────────────────
-- 4. Mention notification function for group DM messages
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_group_dm_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_mention TEXT;
  mention_clean TEXT;
  mentioned_uid UUID;
  sender_name TEXT;
BEGIN
  IF NEW.content NOT LIKE '%@%' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Kullanıcı')
    INTO sender_name
    FROM public.profiles
   WHERE id = NEW.sender_id
   LIMIT 1;

  FOR raw_mention IN
    SELECT (regexp_matches(NEW.content, '@([A-Za-z0-9_\u00C0-\u017E]+)', 'g'))[1]
  LOOP
    mention_clean := raw_mention;

    SELECT id INTO mentioned_uid
      FROM public.profiles
     WHERE lower(username) = lower(mention_clean)
        OR lower(display_name) = lower(mention_clean)
     LIMIT 1;

    IF mentioned_uid IS NOT NULL AND mentioned_uid <> NEW.sender_id THEN
      -- Also verify the mentioned user is actually in this group
      IF EXISTS (
        SELECT 1 FROM public.group_dm_members
         WHERE group_id = NEW.group_id AND user_id = mentioned_uid
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          mentioned_uid,
          'mention',
          sender_name || ' seni etiketledi',
          NEW.content,
          jsonb_build_object(
            'group_id',  NEW.group_id,
            'message_id', NEW.id
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_dm_mention ON public.group_dm_messages;
CREATE TRIGGER on_group_dm_mention
  AFTER INSERT ON public.group_dm_messages
  FOR EACH ROW
  WHEN (NEW.content LIKE '%@%')
  EXECUTE FUNCTION notify_group_dm_mentions();
