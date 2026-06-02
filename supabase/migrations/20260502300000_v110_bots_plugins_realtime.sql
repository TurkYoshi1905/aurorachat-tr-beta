-- v1.1.0: Bot System, Plugin System, Realtime Status Fix,
--          Storage Upsert Fix, profiles created_at
-- ────────────────────────────────────────────────────────────────

-- ── 0. profiles: add created_at column (was missing) ─────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows with updated_at
UPDATE public.profiles SET created_at = updated_at;

CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- ── 1. BOTS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  username    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bots_username ON public.bots(lower(username));
CREATE INDEX IF NOT EXISTS idx_bots_owner_id ON public.bots(owner_id);

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot owners can manage their bots" ON public.bots
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Anyone can view public bots" ON public.bots
  FOR SELECT USING (is_public = true OR owner_id = auth.uid());

-- ── 2. SERVER_BOTS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.server_bots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bot_id      UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  added_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_server_bots_server_id ON public.server_bots(server_id);
CREATE INDEX IF NOT EXISTS idx_server_bots_bot_id    ON public.server_bots(bot_id);

ALTER TABLE public.server_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Server members can view server bots" ON public.server_bots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = server_bots.server_id AND sm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_bots.server_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Server owners can manage bots" ON public.server_bots
  USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_bots.server_id AND s.owner_id = auth.uid()
    )
  );

-- ── 3. PLUGINS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plugins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  css_code      TEXT NOT NULL DEFAULT '',
  js_code       TEXT NOT NULL DEFAULT '',
  version       TEXT NOT NULL DEFAULT '1.0.0',
  preview_url   TEXT,
  install_count INT NOT NULL DEFAULT 0,
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugins_creator_id ON public.plugins(creator_id);
CREATE INDEX IF NOT EXISTS idx_plugins_is_approved ON public.plugins(is_approved);

ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plugin creators can manage their plugins" ON public.plugins
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Anyone can view approved plugins" ON public.plugins
  FOR SELECT USING (is_approved = true OR creator_id = auth.uid());

-- ── 4. USER_PLUGINS TABLE (installed plugins) ────────────────────
CREATE TABLE IF NOT EXISTS public.user_plugins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plugin_id    UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_user_plugins_user_id   ON public.user_plugins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plugins_plugin_id ON public.user_plugins(plugin_id);

ALTER TABLE public.user_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own installed plugins" ON public.user_plugins
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Increment install_count when a plugin is installed
CREATE OR REPLACE FUNCTION increment_plugin_installs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.plugins SET install_count = install_count + 1 WHERE id = NEW.plugin_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_plugin_installed ON public.user_plugins;
CREATE TRIGGER on_plugin_installed
  AFTER INSERT ON public.user_plugins
  FOR EACH ROW EXECUTE FUNCTION increment_plugin_installs();

CREATE OR REPLACE FUNCTION decrement_plugin_installs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.plugins SET install_count = GREATEST(0, install_count - 1) WHERE id = OLD.plugin_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_plugin_uninstalled ON public.user_plugins;
CREATE TRIGGER on_plugin_uninstalled
  AFTER DELETE ON public.user_plugins
  FOR EACH ROW EXECUTE FUNCTION decrement_plugin_installs();

-- ── 5. REALTIME PUBLICATIONS ─────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='plugins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plugins;
  END IF;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- ── 6. STORAGE: fix upsert 400 (missing UPDATE policy) ───────────
DROP POLICY IF EXISTS "Authenticated users can upload attachments"  ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own avatar folder"       ON storage.objects;
DROP POLICY IF EXISTS "Users can update own storage objects"        ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view attachments"                 ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public bucket objects"       ON storage.objects;

CREATE POLICY "Users can upload to own avatar folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    OR (bucket_id = 'chat-attachments')
  );

CREATE POLICY "Users can update own storage objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    (bucket_id = 'avatars'             AND (storage.foldername(name))[1] = auth.uid()::text)
    OR (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  )
  WITH CHECK (
    (bucket_id = 'avatars'             AND (storage.foldername(name))[1] = auth.uid()::text)
    OR (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  );

UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'chat-attachments');

CREATE POLICY "Anyone can view public bucket objects" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('avatars', 'chat-attachments'));

-- ── 7. SEED: sample approved plugins for the store ───────────────
INSERT INTO public.plugins (creator_id, name, description, css_code, js_code, version, is_approved, install_count)
SELECT
  (SELECT p.id FROM public.profiles p ORDER BY p.updated_at LIMIT 1),
  'Compact Mode',
  'Mesaj listesini daha sıkı ve kompakt gösterir.',
  '.chat-message { padding-top: 1px !important; padding-bottom: 1px !important; }',
  '',
  '1.0.0',
  true,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.plugins WHERE name = 'Compact Mode');

INSERT INTO public.plugins (creator_id, name, description, css_code, js_code, version, is_approved, install_count)
SELECT
  (SELECT p.id FROM public.profiles p ORDER BY p.updated_at LIMIT 1),
  'Midnight Theme',
  'Arka planı tam siyah yapar, göz yorgunluğunu azaltır.',
  ':root { --background: 0 0% 0%; --card: 0 0% 4%; }',
  '',
  '1.0.0',
  true,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.plugins WHERE name = 'Midnight Theme');
