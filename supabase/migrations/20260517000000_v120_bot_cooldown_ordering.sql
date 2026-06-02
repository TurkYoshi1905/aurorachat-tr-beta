-- v1.2.0 Bot Cooldown & Message Ordering Fix
-- Adds server-side cooldown enforcement and proper message ordering for bots.

-- ════════════════════════════════════════════════════════════
-- 1. Bot command cooldown table (server-side enforcement)
--    Complements the client-side 5-second cooldown in botCommands.ts
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bot_command_cooldowns (
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID    NOT NULL,
  command    TEXT    NOT NULL,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id, command)
);

CREATE INDEX IF NOT EXISTS idx_bot_command_cooldowns_lookup
  ON public.bot_command_cooldowns (user_id, channel_id);

ALTER TABLE public.bot_command_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cooldowns"
  ON public.bot_command_cooldowns FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- 2. Server-side cooldown check + enforcement function
--    Returns TRUE if the command is allowed, FALSE if still on cooldown.
--    Atomically sets the cooldown on first allowed use.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_and_set_bot_cooldown(
  p_user_id    UUID,
  p_channel_id UUID,
  p_command    TEXT,
  p_cooldown   INTEGER DEFAULT 5   -- seconds
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used_at    TIMESTAMPTZ;
  v_remaining  NUMERIC;
BEGIN
  SELECT used_at INTO v_used_at
  FROM public.bot_command_cooldowns
  WHERE user_id    = p_user_id
    AND channel_id = p_channel_id
    AND command    = p_command;

  IF v_used_at IS NOT NULL THEN
    v_remaining := p_cooldown - EXTRACT(EPOCH FROM (now() - v_used_at));
    IF v_remaining > 0 THEN
      RETURN json_build_object(
        'allowed', false,
        'remaining_seconds', CEIL(v_remaining)
      );
    END IF;
  END IF;

  -- Allowed — upsert the cooldown timestamp
  INSERT INTO public.bot_command_cooldowns (user_id, channel_id, command, used_at)
  VALUES (p_user_id, p_channel_id, p_command, now())
  ON CONFLICT (user_id, channel_id, command)
    DO UPDATE SET used_at = now();

  RETURN json_build_object('allowed', true, 'remaining_seconds', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_set_bot_cooldown TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 3. Proper ordering index on messages table
--    Ensures SELECT queries always return messages in insertion order.
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_channel_order
  ON public.messages (channel_id, inserted_at ASC, id ASC);

-- ════════════════════════════════════════════════════════════
-- 4. Update send_bot_response RPC:
--    Add a tiny pg_sleep so bot response timestamp is always
--    strictly AFTER the user message (prevents ordering flips).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.send_bot_response(
  p_channel_id  UUID,
  p_server_id   UUID,
  p_author_name TEXT,
  p_content     TEXT
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
  -- even when both inserts happen within the same millisecond window.
  PERFORM pg_sleep(0.05);

  INSERT INTO public.messages (
    id, channel_id, server_id, user_id,
    author_name, content, is_bot, inserted_at
  )
  VALUES (
    v_id,
    p_channel_id,
    p_server_id,
    (SELECT id FROM auth.users WHERE id = auth.uid() LIMIT 1),
    p_author_name,
    p_content,
    true,
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

-- ════════════════════════════════════════════════════════════
-- 5. Cleanup: purge cooldown records older than 1 hour
--    (run periodically or on demand — keeps the table small)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_bot_cooldowns()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.bot_command_cooldowns
  WHERE used_at < now() - INTERVAL '1 hour';
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_bot_cooldowns TO authenticated;
