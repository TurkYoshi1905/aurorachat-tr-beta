ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.user_has_server_permission(p_user_id uuid, p_server_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    JOIN public.server_member_roles smr ON smr.member_id = sm.id
    JOIN public.server_roles sr ON sr.id = smr.role_id
    WHERE sm.user_id = p_user_id
      AND sm.server_id = p_server_id
      AND (
        COALESCE((sr.permissions->>'administrator')::boolean, FALSE) = TRUE
        OR COALESCE((sr.permissions->>p_permission)::boolean, FALSE) = TRUE
      )
  );
$$;

DROP POLICY IF EXISTS "Managers can delete server messages" ON public.messages;
CREATE POLICY "Managers can delete server messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.servers s ON s.id = c.server_id
      WHERE c.id = messages.channel_id
        AND (
          s.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.server_members sm
            WHERE sm.server_id = c.server_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin')
          )
          OR public.user_has_server_permission(auth.uid(), c.server_id, 'manage_messages')
        )
    )
  );

CREATE OR REPLACE FUNCTION public.delete_server_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message RECORD;
  v_actor uuid := auth.uid();
  v_can_delete boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı' USING ERRCODE = '42501';
  END IF;

  SELECT
    m.id,
    m.user_id,
    m.content,
    m.channel_id,
    COALESCE(m.server_id, c.server_id) AS server_id,
    c.name AS channel_name
  INTO v_message
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.id = p_message_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT public.is_server_member(v_actor, v_message.server_id) THEN
    RAISE EXCEPTION 'Bu sunucuda değilsiniz' USING ERRCODE = '42501';
  END IF;

  v_can_delete :=
    v_message.user_id = v_actor
    OR EXISTS (SELECT 1 FROM public.servers WHERE id = v_message.server_id AND owner_id = v_actor)
    OR EXISTS (
      SELECT 1
      FROM public.server_members
      WHERE server_id = v_message.server_id
        AND user_id = v_actor
        AND role IN ('owner', 'admin')
    )
    OR public.user_has_server_permission(v_actor, v_message.server_id, 'manage_messages');

  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'Bu mesajı silme yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.messages WHERE id = p_message_id;

  INSERT INTO public.audit_logs (server_id, user_id, action, target_type, target_id, details)
  VALUES (
    v_message.server_id,
    v_actor,
    'message_deleted',
    'message',
    p_message_id,
    jsonb_build_object(
      'channel_id', v_message.channel_id,
      'channel_name', v_message.channel_name,
      'author_id', v_message.user_id,
      'content_preview', LEFT(COALESCE(v_message.content, ''), 120)
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_server_message(uuid) TO authenticated;