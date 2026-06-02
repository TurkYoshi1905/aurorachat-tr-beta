-- v0.9.5 Security: pin messages RLS + username uniqueness constraint

-- 1. Ensure username column has a UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END$$;

-- 2. RLS policy: only server owner/admin or users with pin_messages role permission can pin messages
DROP POLICY IF EXISTS "Only admins can pin messages" ON public.messages;

CREATE POLICY "Only admins can pin messages"
ON public.messages
FOR UPDATE
USING (
  (
    -- User editing their own message content is always allowed
    auth.uid() = user_id
  ) OR (
    -- User is the server owner (servers table)
    EXISTS (
      SELECT 1 FROM public.servers s
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE s.id = c.server_id AND s.owner_id = auth.uid()
    )
  ) OR (
    -- User has owner or admin role in server_members
    EXISTS (
      SELECT 1 FROM public.server_members sm
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE sm.user_id = auth.uid()
        AND sm.server_id = c.server_id
        AND sm.role IN ('owner', 'admin')
    )
  ) OR (
    -- User has a custom role with pin_messages = true
    EXISTS (
      SELECT 1 FROM public.server_members sm
      JOIN public.server_member_roles smr ON smr.member_id = sm.id
      JOIN public.server_roles sr ON sr.id = smr.role_id
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE sm.user_id = auth.uid()
        AND sm.server_id = c.server_id
        AND (sr.permissions->>'pin_messages')::boolean = true
    )
  )
)
WITH CHECK (
  (
    auth.uid() = user_id
  ) OR (
    EXISTS (
      SELECT 1 FROM public.servers s
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE s.id = c.server_id AND s.owner_id = auth.uid()
    )
  ) OR (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE sm.user_id = auth.uid()
        AND sm.server_id = c.server_id
        AND sm.role IN ('owner', 'admin')
    )
  ) OR (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      JOIN public.server_member_roles smr ON smr.member_id = sm.id
      JOIN public.server_roles sr ON sr.id = smr.role_id
      JOIN public.channels c ON c.id = messages.channel_id
      WHERE sm.user_id = auth.uid()
        AND sm.server_id = c.server_id
        AND (sr.permissions->>'pin_messages')::boolean = true
    )
  )
);

-- 3. Helper function: check if a username is already taken
CREATE OR REPLACE FUNCTION public.is_username_taken(p_username text, p_exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_exclude_user_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE username = p_username AND id != p_exclude_user_id
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.profiles WHERE username = p_username
    );
  END IF;
END;
$$;
