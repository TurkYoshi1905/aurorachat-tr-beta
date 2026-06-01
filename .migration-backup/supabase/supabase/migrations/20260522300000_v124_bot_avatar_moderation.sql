-- v1.2.4: Bot avatar in chat (send_bot_response + p_bot_id), cooldown + moderation SQL guards
-- Run this in Supabase SQL Editor to apply all v1.2.4 backend changes.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Update send_bot_response RPC to store bot_id so FK join works
--    (the frontend now passes p_bot_id for custom bots)
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.send_bot_response(
  p_channel_id  UUID,
  p_server_id   UUID,
  p_author_name TEXT,
  p_content     TEXT,
  p_bot_id      UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  -- Brief sleep ensures bot response timestamp > user message timestamp
  PERFORM pg_sleep(0.05);

  INSERT INTO public.messages (
    id, channel_id, server_id, user_id,
    author_name, content, is_bot, bot_id, inserted_at
  )
  VALUES (
    v_id,
    p_channel_id,
    p_server_id,
    (SELECT id FROM auth.users WHERE id = auth.uid() LIMIT 1),
    p_author_name,
    p_content,
    true,
    p_bot_id,
    now()
  );

  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_bot_response failed: %', SQLERRM;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_bot_response TO authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Ensure bots table is readable by all authenticated users
--    (needed for the FK join: bots:bots!messages_bot_id_fkey)
-- ══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bots'
      AND policyname = 'Anyone can read bots'
  ) THEN
    CREATE POLICY "Anyone can read bots"
      ON public.bots FOR SELECT
      USING (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Make sure the covering index (id INCLUDE avatar_url, name) exists
-- ══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_bots_id_covering
  ON public.bots (id)
  INCLUDE (avatar_url, name, username);

-- ══════════════════════════════════════════════════════════════════════
-- 4. Ensure messages.bot_id FK index for efficient JOIN
-- ══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_bot_id_fk
  ON public.messages(bot_id)
  WHERE bot_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 5. user_cooldowns: ensure self-read policy exists (cooldown enforcement)
-- ══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_cooldowns'
      AND policyname = 'Users can read own user_cooldowns'
  ) THEN
    CREATE POLICY "Users can read own user_cooldowns"
      ON public.user_cooldowns FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 6. rate_limit_cooldowns: ensure self-read policy exists
-- ══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rate_limit_cooldowns'
      AND policyname = 'Users can see own cooldowns'
  ) THEN
    CREATE POLICY "Users can see own cooldowns"
      ON public.rate_limit_cooldowns FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 7. get_my_active_cooldown() RPC — returns current user's active cooldown
-- ══════════════════════════════════════════════════════════════════════
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
  SELECT id, reason, cooldown_until INTO v_manual
    FROM user_cooldowns
   WHERE user_id = v_uid AND active = true AND cooldown_until > now()
   ORDER BY cooldown_until DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_manual.id, 'reason', COALESCE(v_manual.reason,''),
      'cooldown_until', v_manual.cooldown_until, 'source', 'manual');
  END IF;
  SELECT id, COALESCE(reason,'Otomatik rate limit') AS reason, cooldown_until INTO v_auto
    FROM rate_limit_cooldowns
   WHERE user_id = v_uid AND cooldown_until > now()
   ORDER BY cooldown_until DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_auto.id, 'reason', v_auto.reason,
      'cooldown_until', v_auto.cooldown_until, 'source', 'auto');
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_active_cooldown() TO authenticated;
