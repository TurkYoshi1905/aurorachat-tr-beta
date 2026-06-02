-- Fix: Ensure message_reactions has REPLICA IDENTITY FULL so that
-- Supabase Realtime DELETE events carry the full row (message_id, user_id, emoji).
-- Without this, poll vote removal events only carry the primary key (id),
-- preventing real-time sync of vote withdrawals across all connected users.

ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Ensure the table is in the realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
