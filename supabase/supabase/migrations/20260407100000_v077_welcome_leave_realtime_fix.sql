-- ============================================================
-- AuroraChat v0.7.7 – Giriş/Çıkış mesajları tam düzeltme
-- Sorun: messages.user_id NOT NULL kısıtlaması ve is_bot
-- sütununun eksikliği nedeniyle trigger INSERT'leri
-- sessizce başarısız oluyordu. Realtime aboneliği ve RLS
-- da güncellendi.
-- ============================================================

-- 1. user_id artık NULL olabilir (bot mesajları için)
ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;

-- 2. is_bot sütunu ekle (yoksa)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. author_name ve server_id sütunları ekle (yoksa)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;

-- 4. messages tablosunu realtime yayınına ekle
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 5. REPLICA IDENTITY FULL — realtime UPDATE/DELETE için tam satır verisi
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 6. RLS politikalarını güncelle: bot mesajları dahil, kanal üyeliği bazlı
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "members_can_read_channel_messages_v2" ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "members_can_read_messages_v3"         ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Server members can read messages"     ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Users can read messages in their channels" ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "members_can_read_messages_v4"
  ON public.messages FOR SELECT
  USING (
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- INSERT: sadece authenticated kullanıcılar kendi mesajlarını ekleyebilir
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Users can insert messages" ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Server members can send messages" ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "members_can_insert_messages_v2"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- UPDATE/DELETE: kendi mesajını veya owner
DO $$
BEGIN
  BEGIN DROP POLICY IF EXISTS "Users can update their own messages"  ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Users can delete their own messages"  ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Server owners can delete messages"    ON public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "members_can_update_own_messages_v2"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "members_can_delete_own_messages_v2"
  ON public.messages FOR DELETE
  USING (
    auth.uid() = user_id
    OR channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.servers s ON s.id = c.server_id
      WHERE s.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 7. Tüm eski welcome/leave trigger'larını ve fonksiyonlarını temizle
-- ============================================================
DROP TRIGGER IF EXISTS on_member_join_welcome       ON public.server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome     ON public.server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v2  ON public.server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome_v3  ON public.server_members;
DROP TRIGGER IF EXISTS trg_welcome_message          ON public.server_members;
DROP TRIGGER IF EXISTS on_member_leave_message      ON public.server_members;
DROP TRIGGER IF EXISTS trg_leave_message            ON public.server_members;

DROP FUNCTION IF EXISTS public.send_welcome_message()        CASCADE;
DROP FUNCTION IF EXISTS public.handle_welcome_message_v3()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_welcome_message_v4()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_welcome_message_v5()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_welcome_message_v6()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_welcome_message_v7()   CASCADE;
DROP FUNCTION IF EXISTS public.handle_leave_message()        CASCADE;
DROP FUNCTION IF EXISTS public.handle_leave_message_v2()     CASCADE;
DROP FUNCTION IF EXISTS public.handle_leave_message_v3()     CASCADE;
DROP FUNCTION IF EXISTS public.handle_leave_message_v4()     CASCADE;

-- ============================================================
-- 8. WELCOME trigger (AFTER INSERT) – v8
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_welcome_message_v8()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server   RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT id, name, welcome_enabled, welcome_message, welcome_channel_id
  INTO   v_server
  FROM   public.servers
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
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_username := COALESCE(v_username, 'Kullanıcı');

  v_message := REPLACE(v_server.welcome_message, '{user}',   '@' || v_username);
  v_message := REPLACE(v_message,                '{server}', COALESCE(v_server.name, ''));

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
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
  RAISE WARNING 'handle_welcome_message_v8 hata: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_welcome_message_v8();

-- ============================================================
-- 9. LEAVE trigger (BEFORE DELETE) – v5
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_leave_message_v5()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server   RECORD;
  v_username TEXT;
  v_message  TEXT;
BEGIN
  SELECT id, name, leave_enabled, leave_message, leave_channel_id
  INTO   v_server
  FROM   public.servers
  WHERE  id = OLD.server_id;

  IF NOT COALESCE(v_server.leave_enabled, FALSE)    THEN RETURN OLD; END IF;
  IF v_server.leave_channel_id IS NULL               THEN RETURN OLD; END IF;
  IF COALESCE(TRIM(v_server.leave_message), '') = '' THEN RETURN OLD; END IF;

  SELECT COALESCE(
    NULLIF(TRIM(display_name), ''),
    NULLIF(TRIM(username), ''),
    'Bir Üye'
  )
  INTO v_username
  FROM public.profiles
  WHERE id = OLD.user_id;

  v_username := COALESCE(v_username, 'Bir Üye');

  v_message := REPLACE(v_server.leave_message, '{user}',   '@' || v_username);
  v_message := REPLACE(v_message,              '{server}', COALESCE(v_server.name, ''));

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
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
  RAISE WARNING 'handle_leave_message_v5 hata: %', SQLERRM;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_member_leave_message
  BEFORE DELETE ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_message_v5();
