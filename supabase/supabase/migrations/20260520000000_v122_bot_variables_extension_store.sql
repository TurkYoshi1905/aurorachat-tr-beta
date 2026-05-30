-- ============================================================
-- v1.2.2: Bot Variable Support + Extension Store (Ratings & Reviews)
-- ============================================================

-- ─── plugin_ratings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugin_ratings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id   UUID        NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars       INTEGER     NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

ALTER TABLE plugin_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_all"  ON plugin_ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own"  ON plugin_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_update_own"  ON plugin_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ratings_delete_own"  ON plugin_ratings FOR DELETE USING (auth.uid() = user_id);

-- ─── plugin_reviews ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  plugin_id   UUID        NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_all"  ON plugin_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own"  ON plugin_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own"  ON plugin_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own"  ON plugin_reviews FOR DELETE USING (auth.uid() = user_id);

-- ─── Realtime ────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE plugin_ratings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE plugin_reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── Helper: avg rating per plugin ───────────────────────────
CREATE OR REPLACE FUNCTION get_plugin_avg_rating(p_plugin_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(AVG(stars), 0) FROM plugin_ratings WHERE plugin_id = p_plugin_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── bots.username NOT NULL guard ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='bots' AND column_name='username'
  ) THEN
    ALTER TABLE bots ADD COLUMN username TEXT;
  END IF;
END $$;
