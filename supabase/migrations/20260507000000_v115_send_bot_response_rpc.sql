-- v1.1.5 — send_bot_response: SECURITY DEFINER RPC for reliable bot message inserts
-- Fixes: bot commands not showing response (is_bot flag missing, RLS edge-cases)
-- Called from the client after executeBotCommand() returns a response.

CREATE OR REPLACE FUNCTION public.send_bot_response(
  p_channel_id  uuid,
  p_server_id   uuid,
  p_author_name text,
  p_content     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_msg_id  uuid := gen_random_uuid();
BEGIN
  -- Guard: caller must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: caller must be a member of the server that owns this channel
  IF NOT EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.server_members sm ON sm.server_id = c.server_id
    WHERE c.id = p_channel_id
      AND sm.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  INSERT INTO public.messages (
    id,
    channel_id,
    server_id,
    user_id,
    author_name,
    content,
    is_bot,
    inserted_at
  ) VALUES (
    v_msg_id,
    p_channel_id,
    p_server_id,
    v_user_id,
    p_author_name,
    p_content,
    TRUE,
    now()
  );

  RETURN v_msg_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.send_bot_response(uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_bot_response(uuid, uuid, text, text) TO authenticated;
