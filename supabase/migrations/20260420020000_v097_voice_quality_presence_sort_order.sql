CREATE TABLE IF NOT EXISTS public.voice_channel_members (
  channel_id TEXT NOT NULL,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  mic_muted BOOLEAN NOT NULL DEFAULT FALSE,
  camera_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  screen_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE public.voice_channel_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view voice members" ON public.voice_channel_members;
CREATE POLICY "Anyone authenticated can view voice members"
  ON public.voice_channel_members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can upsert own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can upsert own voice member row"
  ON public.voice_channel_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can update own voice member row"
  ON public.voice_channel_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice member row" ON public.voice_channel_members;
CREATE POLICY "Users can delete own voice member row"
  ON public.voice_channel_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_voice_channel_members_server_channel
  ON public.voice_channel_members(server_id, channel_id, joined_at);

CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.voice_channel_members
  WHERE joined_at < now() - interval '2 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_voice_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_members() TO authenticated;

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS sort_order INTEGER;

UPDATE public.channels
SET sort_order = position
WHERE sort_order IS NULL;

ALTER TABLE public.channels ALTER COLUMN sort_order SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_channel_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.sort_order := COALESCE(NEW.sort_order, NEW.position, 0);
    NEW.position := COALESCE(NEW.position, NEW.sort_order, 0);
    RETURN NEW;
  END IF;

  IF NEW.sort_order IS DISTINCT FROM OLD.sort_order AND NEW.position IS NOT DISTINCT FROM OLD.position THEN
    NEW.position := COALESCE(NEW.sort_order, 0);
  ELSIF NEW.position IS DISTINCT FROM OLD.position AND NEW.sort_order IS NOT DISTINCT FROM OLD.sort_order THEN
    NEW.sort_order := COALESCE(NEW.position, 0);
  ELSE
    NEW.sort_order := COALESCE(NEW.sort_order, NEW.position, 0);
    NEW.position := COALESCE(NEW.position, NEW.sort_order, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_channel_sort_order ON public.channels;
CREATE TRIGGER trg_sync_channel_sort_order
  BEFORE INSERT OR UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_channel_sort_order();

CREATE INDEX IF NOT EXISTS idx_channels_server_sort_order
  ON public.channels(server_id, sort_order, position);

ALTER TABLE public.voice_channel_members ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.voice_channel_members ADD COLUMN IF NOT EXISTS screen_sharing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.voice_channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'voice_channel_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_channel_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  END IF;
END $$;

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
  SELECT COALESCE(NULLIF(TRIM(username), ''), NULLIF(TRIM(display_name), ''), 'Kullanıcı')
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