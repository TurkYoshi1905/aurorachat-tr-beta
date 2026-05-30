-- v1.2.3: Cooldown Enforcement — Ensure users can query their own active cooldowns
-- The frontend useCooldown hook checks both tables; policies must allow self-read.

-- 1. user_cooldowns: ensure self-read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_cooldowns'
      AND policyname = 'Users can read own user_cooldowns'
  ) THEN
    CREATE POLICY "Users can read own user_cooldowns"
      ON public.user_cooldowns FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 2. rate_limit_cooldowns: ensure self-read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'rate_limit_cooldowns'
      AND policyname = 'Users can see own cooldowns'
  ) THEN
    CREATE POLICY "Users can see own cooldowns"
      ON public.rate_limit_cooldowns FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3. Ensure realtime is enabled for user_cooldowns (so frontend hook gets live updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_cooldowns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_cooldowns;
  END IF;
END $$;

-- 4. Ensure realtime is enabled for rate_limit_cooldowns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rate_limit_cooldowns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rate_limit_cooldowns;
  END IF;
END $$;

-- 5. Helper RPC: get_my_active_cooldown() — returns the most restrictive cooldown for current user
CREATE OR REPLACE FUNCTION get_my_active_cooldown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manual  RECORD;
  v_auto    RECORD;
  v_uid     uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  -- Check manual cooldown first (higher priority)
  SELECT id, reason, cooldown_until
    INTO v_manual
    FROM user_cooldowns
   WHERE user_id    = v_uid
     AND active     = true
     AND cooldown_until > now()
   ORDER BY cooldown_until DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id',            v_manual.id,
      'reason',        COALESCE(v_manual.reason, ''),
      'cooldown_until', v_manual.cooldown_until,
      'source',        'manual'
    );
  END IF;

  -- Check auto rate-limit cooldown
  SELECT id, COALESCE(reason, 'Otomatik rate limit') AS reason, cooldown_until
    INTO v_auto
    FROM rate_limit_cooldowns
   WHERE user_id      = v_uid
     AND cooldown_until > now()
   ORDER BY cooldown_until DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id',            v_auto.id,
      'reason',        v_auto.reason,
      'cooldown_until', v_auto.cooldown_until,
      'source',        'auto'
    );
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_active_cooldown() TO authenticated;
