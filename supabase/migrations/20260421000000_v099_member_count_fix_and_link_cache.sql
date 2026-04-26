-- v0.9.6 — Fix {memberCount} placeholder in welcome/leave messages and add link_previews cache.
-- Problem 1: handle_leave_message_v6 was BEFORE DELETE → COUNT(*) still included the leaving user.
-- Problem 2: render_server_template did not allow callers to compensate for trigger timing.
-- Solution: Make leave trigger AFTER DELETE so COUNT reflects the post-leave member count.
-- Also: small numeric delta parameter on render_server_template for safety/back-compat.

CREATE OR REPLACE FUNCTION public.render_server_template(
  p_template TEXT,
  p_user_id UUID,
  p_server_id UUID,
  p_mention BOOLEAN DEFAULT TRUE,
  p_count_delta INTEGER DEFAULT 0
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
  v_member_count := GREATEST(COALESCE(v_member_count, 0) + COALESCE(p_count_delta, 0), 0);

  v_message := COALESCE(p_template, '');
  v_message := REPLACE(v_message, '{user}', CASE WHEN p_mention THEN '@' || v_username ELSE v_username END);
  v_message := REPLACE(v_message, '{username}', v_username);
  v_message := REPLACE(v_message, '{serverName}', v_server_name);
  v_message := REPLACE(v_message, '{server}', v_server_name);
  v_message := REPLACE(v_message, '{memberCount}', v_member_count::TEXT);
  RETURN v_message;
END;
$$;

-- Recreate leave handler to run AFTER DELETE so COUNT reflects post-leave count.
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

  IF NOT COALESCE(v_server.leave_enabled, FALSE) THEN RETURN NULL; END IF;
  IF v_server.leave_channel_id IS NULL THEN RETURN NULL; END IF;
  IF COALESCE(TRIM(v_server.leave_message), '') = '' THEN RETURN NULL; END IF;

  -- AFTER DELETE: row is already gone, so COUNT is correct without a delta.
  v_message := public.render_server_template(v_server.leave_message, OLD.user_id, OLD.server_id, FALSE, 0);

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (v_server.leave_channel_id, NULL, 'AuroraChat Bot', TRUE, v_message, OLD.server_id, NOW());

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_leave_message_v6 hata: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Welcome handler: AFTER INSERT already includes new member, no delta needed.
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

  v_message := public.render_server_template(v_server.welcome_message, NEW.user_id, NEW.server_id, TRUE, 0);

  INSERT INTO public.messages (channel_id, user_id, author_name, is_bot, content, server_id, inserted_at)
  VALUES (v_server.welcome_channel_id, NULL, 'AuroraChat Bot', TRUE, v_message, NEW.server_id, NOW());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_welcome_message_v9 hata: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Replace existing leave trigger (was BEFORE DELETE) with AFTER DELETE.
DROP TRIGGER IF EXISTS on_member_leave_message ON public.server_members;
CREATE TRIGGER on_member_leave_message
  AFTER DELETE ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_message_v6();

-- Welcome trigger (AFTER INSERT) is already correct; ensure it exists.
DROP TRIGGER IF EXISTS on_member_join_welcome ON public.server_members;
CREATE TRIGGER on_member_join_welcome
  AFTER INSERT ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_welcome_message_v9();

-- ─────────────────────────────────────────────────────────────────────────────
-- Link Preview cache table — used by link-preview edge function.
-- Caches OG metadata for up to 7 days to avoid re-scraping the same URL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.link_previews (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image TEXT,
  site_name TEXT,
  favicon TEXT,
  type TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_previews_fetched_at ON public.link_previews(fetched_at);

ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "link_previews_select_all" ON public.link_previews;
CREATE POLICY "link_previews_select_all"
  ON public.link_previews
  FOR SELECT
  TO authenticated
  USING (true);

-- Only the service role (edge function) can insert/update; authenticated users only read.
DROP POLICY IF EXISTS "link_previews_insert_service" ON public.link_previews;
CREATE POLICY "link_previews_insert_service"
  ON public.link_previews
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "link_previews_update_service" ON public.link_previews;
CREATE POLICY "link_previews_update_service"
  ON public.link_previews
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Make the table visible to realtime subscribers (in case clients want to listen).
ALTER PUBLICATION supabase_realtime ADD TABLE public.link_previews;
