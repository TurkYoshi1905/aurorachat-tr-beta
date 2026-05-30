-- v1.2.5: Drag-drop channel sorting + plugin_reviews FK fix
-- Run this in Supabase SQL Editor after deploying v1.2.5

-- ─── 1. channels.position column for drag-drop ordering ──────────────────────
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Back-fill existing channels: assign sequential positions per server
WITH numbered AS (
  SELECT id, server_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY server_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.channels
)
UPDATE public.channels c
SET position = n.rn
FROM numbered n
WHERE c.id = n.id AND c.position = 0;

-- Index for fast ordered lookups
CREATE INDEX IF NOT EXISTS idx_channels_position
  ON public.channels (server_id, category_id, position);

-- ─── 2. plugin_reviews → profiles FK (fixes PGRST200 join error) ─────────────
-- Drop old constraint if it exists (may have wrong target)
ALTER TABLE public.plugin_reviews
  DROP CONSTRAINT IF EXISTS plugin_reviews_user_id_fkey;

-- Re-add FK pointing to public.profiles (PostgREST requires this for join syntax)
ALTER TABLE public.plugin_reviews
  ADD CONSTRAINT plugin_reviews_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles (id)
  ON DELETE CASCADE;

-- Index to support the FK join efficiently
CREATE INDEX IF NOT EXISTS idx_plugin_reviews_user_id
  ON public.plugin_reviews (user_id);

-- ─── 3. Enable realtime for channels (position updates) ─────────────────────
-- Channels table should already be in realtime; this is a safe no-op if so
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication, ignore
  END;
END $$;
