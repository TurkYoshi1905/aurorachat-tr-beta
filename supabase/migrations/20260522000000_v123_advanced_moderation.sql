-- ============================================================
-- v1.2.3: Advanced Moderation Hierarchy, Cooldown System,
--         Bot Member List Fix, and Database Optimizations
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. FIX get_community_servers(): STABLE → VOLATILE
--    "SET is not allowed in a non-volatile function (0A000)"
--    Root cause: SET LOCAL inside a STABLE-declared function is
--    forbidden by PostgreSQL. Changing to VOLATILE resolves it.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_community_servers(
  p_search   text    DEFAULT NULL,
  p_category text    DEFAULT NULL,
  p_limit    int     DEFAULT 20,
  p_offset   int     DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  community_description text,
  community_category    text,
  icon_url              text,
  member_count          bigint,
  created_at            timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.community_description,
    s.community_category,
    s.icon              AS icon_url,
    COUNT(sm.id)        AS member_count,
    s.created_at
  FROM servers s
  LEFT JOIN server_members sm ON sm.server_id = s.id
  WHERE
    s.is_community = true
    AND (
      p_search IS NULL
      OR s.name ILIKE '%' || p_search || '%'
      OR s.community_description ILIKE '%' || p_search || '%'
    )
    AND (p_category IS NULL OR s.community_category = p_category)
  GROUP BY s.id
  ORDER BY member_count DESC, s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_servers(text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_community_servers(text, text, int, int) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. FOUNDER IDENTITY HELPER
--    Returns the UUID of the app founder (asfurkan140@gmail.com)
--    so RLS policies can enforce absolute immunity.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_founder_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT id FROM auth.users WHERE email = 'asfurkan140@gmail.com' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_founder_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founder_id() TO anon;


-- ─────────────────────────────────────────────────────────────
-- 3. USER COOLDOWNS TABLE (Moderator-applied manual cooldowns)
--    Separate from rate_limit_cooldowns (automated rate limiter).
--    Moderators use this to manually impose timed restrictions.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_cooldowns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  applied_by      uuid        NOT NULL REFERENCES profiles(id),
  reason          text,
  duration_minutes int        NOT NULL DEFAULT 5,
  cooldown_until  timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  lifted_at       timestamptz,
  lifted_by       uuid        REFERENCES profiles(id),
  active          boolean     NOT NULL DEFAULT true
);

ALTER TABLE user_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_cooldowns_user    ON user_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns_active  ON user_cooldowns(active, cooldown_until DESC);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns_applied ON user_cooldowns(applied_by);

-- Admins / founders can read all cooldowns
DROP POLICY IF EXISTS "Admins can read all user_cooldowns" ON user_cooldowns;
CREATE POLICY "Admins can read all user_cooldowns"
  ON user_cooldowns FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_app_admin = true)
      OR auth.uid() = public.get_founder_id()
      OR EXISTS(SELECT 1 FROM mod_role_assignments WHERE user_id = auth.uid())
    )
  );

-- Admins / mod-role holders can insert (with hierarchy enforcement at app level)
DROP POLICY IF EXISTS "Admins can insert user_cooldowns" ON user_cooldowns;
CREATE POLICY "Admins can insert user_cooldowns"
  ON user_cooldowns FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_app_admin = true)
      OR auth.uid() = public.get_founder_id()
      OR EXISTS(SELECT 1 FROM mod_role_assignments WHERE user_id = auth.uid())
    )
    -- Founder is immune: cannot be the target of a cooldown
    AND user_id != COALESCE(public.get_founder_id(), '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Admins / mod-role holders can update (lift cooldown)
DROP POLICY IF EXISTS "Admins can update user_cooldowns" ON user_cooldowns;
CREATE POLICY "Admins can update user_cooldowns"
  ON user_cooldowns FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_app_admin = true)
      OR auth.uid() = public.get_founder_id()
      OR EXISTS(SELECT 1 FROM mod_role_assignments WHERE user_id = auth.uid())
    )
  );

-- Users can read their own cooldown status
DROP POLICY IF EXISTS "Users can read own user_cooldowns" ON user_cooldowns;
CREATE POLICY "Users can read own user_cooldowns"
  ON user_cooldowns FOR SELECT
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- 4. APPLY MANUAL COOLDOWN RPC
--    Enforces hierarchy: caller level must be > target level.
--    Founder is always immune.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_manual_cooldown(
  p_target_user_id  uuid,
  p_reason          text,
  p_duration_minutes int
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid := auth.uid();
  v_founder_id   uuid := public.get_founder_id();
  v_caller_level int  := 0;
  v_target_level int  := 0;
  v_caller_role  text;
  v_target_role  text;
  v_until        timestamptz;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oturum açmanız gerekiyor');
  END IF;

  -- Founder is immune
  IF p_target_user_id = v_founder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kurucu kullanıcıya işlem uygulanamaz');
  END IF;

  -- Caller level determination
  IF v_caller_id = v_founder_id THEN
    v_caller_level := 99;
  ELSIF EXISTS(SELECT 1 FROM profiles WHERE id = v_caller_id AND is_app_admin = true) THEN
    v_caller_level := 5;
  ELSE
    SELECT mod_role INTO v_caller_role FROM mod_role_assignments WHERE user_id = v_caller_id;
    v_caller_level := CASE v_caller_role
      WHEN 'yetkili'         THEN 4
      WHEN 'admin'           THEN 3
      WHEN 'moderator'       THEN 2
      WHEN 'deneme_moderator' THEN 1
      ELSE 0
    END;
  END IF;

  IF v_caller_level = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu işlem için yetkiniz bulunmuyor');
  END IF;

  -- Target level determination
  SELECT mod_role INTO v_target_role FROM mod_role_assignments WHERE user_id = p_target_user_id;
  v_target_level := CASE v_target_role
    WHEN 'yetkili'         THEN 4
    WHEN 'admin'           THEN 3
    WHEN 'moderator'       THEN 2
    WHEN 'deneme_moderator' THEN 1
    ELSE 0
  END;

  -- Hierarchy check: cannot act on same or higher level
  IF v_caller_level <= v_target_level AND v_caller_level < 99 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aynı veya daha yüksek roldeki kullanıcıya işlem uygulanamaz');
  END IF;

  v_until := now() + (p_duration_minutes * interval '1 minute');

  INSERT INTO user_cooldowns(user_id, applied_by, reason, duration_minutes, cooldown_until)
  VALUES (p_target_user_id, v_caller_id, p_reason, p_duration_minutes, v_until);

  RETURN jsonb_build_object('success', true, 'cooldown_until', v_until::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_manual_cooldown(uuid, text, int) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. LIFT MANUAL COOLDOWN RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lift_manual_cooldown(
  p_cooldown_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_founder_id uuid := public.get_founder_id();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oturum açmanız gerekiyor');
  END IF;

  IF NOT (
    v_caller_id = v_founder_id
    OR EXISTS(SELECT 1 FROM profiles WHERE id = v_caller_id AND is_app_admin = true)
    OR EXISTS(SELECT 1 FROM mod_role_assignments WHERE user_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetki yetersiz');
  END IF;

  UPDATE user_cooldowns
  SET active = false, lifted_at = now(), lifted_by = v_caller_id
  WHERE id = p_cooldown_id AND active = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lift_manual_cooldown(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 6. ENABLE REALTIME ON user_cooldowns
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_cooldowns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_cooldowns;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 7. BOT AVATAR STORAGE POLICY FIX
--    Allow bot owners to upload to avatars bucket under
--    the bot-avatars/ prefix.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Insert policy: bot owner can upload bot avatars
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Bot owners can upload bot avatars'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Bot owners can upload bot avatars"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'avatars'
          AND name LIKE 'bot-avatars/%'
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.bots
            WHERE owner_id = auth.uid()
          )
        );
    $policy$;
  END IF;

  -- Update/upsert policy: bot owner can overwrite bot avatars
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Bot owners can update bot avatars'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Bot owners can update bot avatars"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'avatars'
          AND name LIKE 'bot-avatars/%'
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.bots
            WHERE owner_id = auth.uid()
          )
        );
    $policy$;
  END IF;

  -- Select policy: anyone can read bot avatars
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can read bot avatars'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anyone can read bot avatars"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'avatars' AND name LIKE 'bot-avatars/%');
    $policy$;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. MOD ROLE HIERARCHY PROTECTION FOR ACCOUNT BANS
--    Prevent same-level or lower-level mod from banning
--    higher-level mods or the founder.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hierarchy-aware account ban insert" ON account_bans;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='account_bans') THEN
    EXECUTE $p$
      CREATE POLICY "Hierarchy-aware account ban insert"
        ON account_bans FOR INSERT
        WITH CHECK (
          auth.uid() IS NOT NULL
          AND (
            auth.uid() = public.get_founder_id()
            OR EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true)
            OR EXISTS(SELECT 1 FROM public.mod_role_assignments WHERE user_id = auth.uid())
          )
          -- Founder is always immune
          AND banned_user_id != COALESCE(public.get_founder_id(), '00000000-0000-0000-0000-000000000000'::uuid)
        );
    $p$;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 9. ADD EXTRA BOT VARIABLES - extend bots table if needed
--    No schema changes needed, variables are handled in frontend
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 10. ADD reason COLUMN to rate_limit_cooldowns if missing
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rate_limit_cooldowns'
      AND column_name = 'reason'
  ) THEN
    ALTER TABLE rate_limit_cooldowns ADD COLUMN reason text;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- END v1.2.3 migration
-- ─────────────────────────────────────────────────────────────
