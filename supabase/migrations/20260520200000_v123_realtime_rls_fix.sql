-- ============================================================
-- v1.2.3 — Realtime timeout & RLS root-cause fix
--
-- ROOT CAUSES IDENTIFIED:
--   1. Global statement_timeout = 15s broke Supabase Realtime
--      (schema introspection ~14.7s, RLS eval stacking under load)
--   2. messages REPLICA IDENTITY FULL → huge WAL volume on every INSERT
--   3. members_can_read_messages_v4: double JOIN on every realtime event
--   4. Missing composite index for the fast RLS path
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. REMOVE GLOBAL statement_timeout  ← ROOT CAUSE FIX #1
--    The 15s limit was canceling Supabase Realtime's internal
--    schema-reload queries (~14.7s) and RLS evaluations under load.
--    We keep idle_in_transaction_session_timeout (guards stuck txns).
--    Role-level timeouts in individual RPCs are NOT affected.
-- ─────────────────────────────────────────────────────────────
ALTER DATABASE postgres RESET statement_timeout;

-- Keep a generous idle-in-transaction guard (reduces zombie connections)
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '60s';

-- Lock timeout: raise to avoid false "statement timeout" on DDL
ALTER DATABASE postgres SET lock_timeout = '30s';

-- Optional per-role limit — high enough to not cause false alarms
-- Realtime uses 'authenticated' role for RLS checks
ALTER ROLE authenticated RESET statement_timeout;
ALTER ROLE anon          RESET statement_timeout;


-- ─────────────────────────────────────────────────────────────
-- 2. REDUCE REPLICA IDENTITY ON messages  ← ROOT CAUSE FIX #2
--    FULL sends every column on every WAL event.
--    DELETE handler in Index.tsx only needs `old.id` (the PK),
--    so DEFAULT (PK-only) is sufficient and far cheaper.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.messages REPLICA IDENTITY DEFAULT;

-- friends / blocked_users: code only calls fetchFriends() / fetchBlockedUsers()
-- on change — it never reads payload.old columns.
ALTER TABLE public.friends       REPLICA IDENTITY DEFAULT;
ALTER TABLE public.blocked_users REPLICA IDENTITY DEFAULT;


-- ─────────────────────────────────────────────────────────────
-- 3. ADD server_id TO messages  ← ROOT CAUSE FIX #3
--    Allows RLS to skip the channels JOIN:
--      OLD: channel_id IN (SELECT c.id FROM channels c JOIN server_members sm …)
--      NEW: EXISTS (SELECT 1 FROM server_members WHERE user_id=? AND server_id=?)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS server_id uuid
  REFERENCES public.servers(id) ON DELETE CASCADE;

-- Index for the new RLS check
CREATE INDEX IF NOT EXISTS idx_messages_server_id
  ON public.messages(server_id);

-- Composite index: covers "WHERE user_id = auth.uid() AND server_id = ?"
CREATE INDEX IF NOT EXISTS idx_server_members_uid_sid
  ON public.server_members(user_id, server_id);

-- Trigger: auto-fill server_id on INSERT
CREATE OR REPLACE FUNCTION public.messages_populate_server_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.server_id IS NULL AND NEW.channel_id IS NOT NULL THEN
    SELECT server_id INTO NEW.server_id
    FROM public.channels WHERE id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_server_id ON public.messages;
CREATE TRIGGER trg_messages_server_id
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_populate_server_id();

-- Backfill existing messages (batched, 10 000 rows at a time to avoid lock)
DO $$
DECLARE
  rows_updated int;
BEGIN
  LOOP
    UPDATE public.messages m
    SET server_id = c.server_id
    FROM public.channels c
    WHERE c.id = m.channel_id
      AND m.server_id IS NULL
      AND m.ctid IN (
        SELECT ctid FROM public.messages WHERE server_id IS NULL LIMIT 10000
      );
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 4. REPLACE messages SELECT RLS POLICY  ← ROOT CAUSE FIX #3 (cont.)
--    Old policy: channel_id IN (… JOIN …) — two table scans
--    New policy: EXISTS (server_members WHERE uid+sid) — index-only scan
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "members_can_read_messages_v4" ON public.messages;
  DROP POLICY IF EXISTS "members_can_read_messages_v5" ON public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "members_can_read_messages_v5"
  ON public.messages FOR SELECT
  USING (
    -- Fast path: server_id populated (all new rows + backfilled rows)
    (
      server_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.server_members
        WHERE user_id = auth.uid()
          AND server_id = messages.server_id
      )
    )
    OR
    -- Fallback: very old rows that weren't backfilled
    (
      server_id IS NULL
      AND channel_id IN (
        SELECT c.id FROM public.channels c
        JOIN public.server_members sm ON sm.server_id = c.server_id
        WHERE sm.user_id = auth.uid()
      )
    )
  );

-- Also update INSERT policy to use server_id
DO $$
BEGIN
  DROP POLICY IF EXISTS "members_can_insert_messages_v2" ON public.messages;
  DROP POLICY IF EXISTS "members_can_insert_messages_v3" ON public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "members_can_insert_messages_v3"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        server_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.server_members
          WHERE user_id = auth.uid()
            AND server_id = messages.server_id
        )
      )
      OR
      channel_id IN (
        SELECT c.id FROM public.channels c
        JOIN public.server_members sm ON sm.server_id = c.server_id
        WHERE sm.user_id = auth.uid()
      )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 5. MAKE is_dm_participant SECURITY DEFINER
--    Prevents per-row auth context switches during RLS evaluation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_dm_participant(p_user_id uuid, p_conv_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_conversations
    WHERE id = p_conv_id
      AND (user1_id = p_user_id OR user2_id = p_user_id)
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- 6. EXTRA INDEXES (fill any remaining gaps)
-- ─────────────────────────────────────────────────────────────

-- channels(id, server_id) — covers the fallback RLS path
CREATE INDEX IF NOT EXISTS idx_channels_id_srv
  ON public.channels(id, server_id);

-- direct_messages: sender lookup for DM dashboard subscription
CREATE INDEX IF NOT EXISTS idx_dm_sender_conv
  ON public.direct_messages(conversation_id, sender_id, inserted_at DESC);

-- friends: both directions for fast RLS check
CREATE INDEX IF NOT EXISTS idx_friends_uid_fid
  ON public.friends(user_id, friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_fid_uid
  ON public.friends(friend_id, user_id);

-- profiles: status + id for fast presence lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id_status
  ON public.profiles(id, status);


-- ─────────────────────────────────────────────────────────────
-- 7. ANALYZE updated tables so planner picks new indexes
-- ─────────────────────────────────────────────────────────────
ANALYZE public.messages;
ANALYZE public.server_members;
ANALYZE public.channels;
ANALYZE public.direct_messages;
ANALYZE public.friends;
ANALYZE public.profiles;
