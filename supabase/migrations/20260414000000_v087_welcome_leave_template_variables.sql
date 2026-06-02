ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS leave_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS leave_message TEXT DEFAULT 'Güle güle {user}!';
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS leave_channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.render_server_template(
  p_template TEXT,
  p_user_id UUID,
  p_server_id UUID,
  p_mention BOOLEAN DEFAULT TRUE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_server_name TEXT;
  v_member_count INTEGER;
  v_message TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(username), ''), 'Kullanıcı')
  INTO v_username
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT name INTO v_server_name FROM public.servers WHERE id = p_server_id;
  SELECT COUNT(*)::INTEGER INTO v_member_count FROM public.server_members WHERE server_id = p_server_id;

  v_username := COALESCE(v_username, 'Kullanıcı');
  v_server_name := COALESCE(v_server_name, '');
  v_message := COALESCE(p_template, '');
  v_message := REPLACE(v_message, '{user}', CASE WHEN p_mention THEN '@' || v_username ELSE v_username END);
  v_message := REPLACE(v_message, '{username}', v_username);
  v_message := REPLACE(v_message, '{serverName}', v_server_name);
  v_message := REPLACE(v_message, '{server}', v_server_name);
  v_message := REPLACE(v_message, '{memberCount}', COALESCE(v_member_count, 0)::TEXT);
  RETURN v_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_welcome_message_v9()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server RECORD;
  v_message TEXT;
BEGIN
  SELECT id, welcome_enabled, welcome_message, welcome_channel_id
  INTO v_server
  FROM public.servers
  WHERE id = NEW.server_id;

  IF NOT COALESCE(v_server.welcome_enabled, FALSE) THEN RETURN NEW; END IF;
  IF v_server.welcome_channel_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(TRIM(v_server.welcome_message), '') = '' THEN RETURN NEW; END IF;

  v_message := public.render_server_template(v_server.welcome_message, NEW.user_id, NEW.server_id, TRUE);

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (v_server.welcome_channel_id, NULL, 'AuroraChat Bot', TRUE, v_message, NEW.server_id, NOW());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_welcome_message_v9 hata: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_leave_message_v6()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server RECORD;
  v_message TEXT;
BEGIN
  SELECT id, leave_enabled, leave_message, leave_channel_id
  INTO v_server
  FROM public.servers
  WHERE id = OLD.server_id;

  IF NOT COALESCE(v_server.leave_enabled, FALSE) THEN RETURN OLD; END IF;
  IF v_server.leave_channel_id IS NULL THEN RETURN OLD; END IF;
  IF COALESCE(TRIM(v_server.leave_message), '') = '' THEN RETURN OLD; END IF;

  v_message := public.render_server_template(v_server.leave_message, OLD.user_id, OLD.server_id, TRUE);

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (v_server.leave_channel_id, NULL, 'AuroraChat Bot', TRUE, v_message, OLD.server_id, NOW());

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_leave_message_v6 hata: %', SQLERRM;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_member_join_welcome ON public.server_members;
DROP TRIGGER IF EXISTS on_member_joined_welcome ON public.server_members;
DROP TRIGGER IF EXISTS trg_welcome_message ON public.server_members;
DROP TRIGGER IF EXISTS on_member_leave_message ON public.server_members;
DROP TRIGGER IF EXISTS trg_leave_message ON public.server_members;

CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_welcome_message_v9();

CREATE TRIGGER on_member_leave_message
  BEFORE DELETE ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_message_v6();