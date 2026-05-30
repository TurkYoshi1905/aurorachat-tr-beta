-- Add privacy columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_dms boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_request_setting text NOT NULL DEFAULT 'everyone' CHECK (friend_request_setting IN ('everyone', 'friends', 'none'));

-- Set REPLICA IDENTITY FULL on message_reactions so DELETE events carry full row data in Realtime
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Ensure message_reactions is in the realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS: Prevent a blocked user from sending DMs to the user who blocked them
-- When user A blocks user B, user B cannot send messages in any conversation shared with A
DROP POLICY IF EXISTS "block_blocked_users_from_dms" ON public.direct_messages;

CREATE POLICY "block_blocked_users_from_dms" ON public.direct_messages
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM public.blocked_users bu
      JOIN public.dm_conversations dc ON dc.id = conversation_id
      WHERE bu.blocked_id = auth.uid()
        AND (bu.blocker_id = dc.user1_id OR bu.blocker_id = dc.user2_id)
    )
  );
