ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_user_id uuid;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS sender_deleted_user_id uuid;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.messages'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.direct_messages'::regclass
      AND c.contype = 'f'
      AND a.attname = 'sender_id'
  LOOP
    EXECUTE format('ALTER TABLE public.direct_messages DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.direct_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.dm_conversations'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user1_id'
  LOOP
    EXECUTE format('ALTER TABLE public.dm_conversations DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.dm_conversations'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user2_id'
  LOOP
    EXECUTE format('ALTER TABLE public.dm_conversations DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.dm_conversations ALTER COLUMN user1_id DROP NOT NULL;
ALTER TABLE public.dm_conversations ALTER COLUMN user2_id DROP NOT NULL;
ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_user1_id_fkey
  FOREIGN KEY (user1_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_user2_id_fkey
  FOREIGN KEY (user2_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_user_id ON public.messages(deleted_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_deleted_user_id ON public.direct_messages(sender_deleted_user_id);