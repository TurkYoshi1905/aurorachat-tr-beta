-- v1.2.3: Bot Avatar in Member List & Chat
-- Ensures bot avatars render correctly in both the server member list and server chat.
-- The frontend now joins bots table via messages.bot_id FK to fetch avatar_url on-the-fly.
-- This migration ensures the supporting DB structure is correct.

-- 1. Ensure bots table has a public SELECT policy so the FK join works for all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'bots'
      AND policyname = 'Bots are publicly readable'
  ) THEN
    CREATE POLICY "Bots are publicly readable"
      ON public.bots FOR SELECT
      USING (true);
  END IF;
END $$;

-- 2. Ensure messages.bot_id FK index exists for efficient JOIN
CREATE INDEX IF NOT EXISTS idx_messages_bot_id_fk
  ON public.messages(bot_id)
  WHERE bot_id IS NOT NULL;

-- 3. Ensure server_bots can be read by server members (for member list avatar join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'server_bots'
      AND policyname = 'Server members can read server bots'
  ) THEN
    CREATE POLICY "Server members can read server bots"
      ON public.server_bots FOR SELECT
      USING (
        server_id IN (
          SELECT server_id FROM server_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 4. Ensure bots.avatar_url column exists (it should, but guard just in case)
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 5. Index bots.avatar_url isn't needed (text value lookup not range scan),
--    but add index on bots.id for the FK join path if missing
CREATE INDEX IF NOT EXISTS idx_bots_id_cover
  ON public.bots(id)
  INCLUDE (avatar_url, name, username);
