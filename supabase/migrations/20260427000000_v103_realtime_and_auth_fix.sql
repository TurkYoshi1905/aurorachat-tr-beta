-- =====================================================================
-- AuroraChat v1.0.3 migration
--
-- Goals:
-- 1) Hard-fix the "Database error saving new user" error by making
--    handle_new_user() robust against username UNIQUE collisions
--    (introduced in v0.9.4) and by wrapping the entire profile insert
--    in an EXCEPTION block so it can never poison auth.users insert.
-- 2) Re-confirm REPLICA IDENTITY FULL + realtime publication for the
--    tables driving the live UI: server_member_roles, server_roles,
--    message_reports, account_bans, profiles.
-- 3) Make sure account_bans rows carry the reason on realtime payloads
--    (REPLICA IDENTITY FULL needed so the BanModal can read it).
--
-- This migration is fully idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Bullet-proof handle_new_user
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta_username     text;
  meta_display_name text;
  meta_avatar_url   text;
  meta_gender       text;
  meta_birth_date   text;
  parsed_birth_date date;
  base_username     text;
  candidate         text;
  attempt           integer := 0;
BEGIN
  meta_username     := NULLIF(NEW.raw_user_meta_data->>'username', '');
  meta_display_name := NULLIF(NEW.raw_user_meta_data->>'display_name', '');
  meta_avatar_url   := NULLIF(NEW.raw_user_meta_data->>'avatar_url', '');
  meta_gender       := NULLIF(NEW.raw_user_meta_data->>'gender', '');
  meta_birth_date   := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');

  -- Validate gender against allowed values; ignore otherwise
  IF meta_gender IS NOT NULL
     AND meta_gender NOT IN ('male', 'female', 'other', 'prefer_not_to_say') THEN
    meta_gender := NULL;
  END IF;

  -- Safely parse birth_date; ignore unparseable strings
  IF meta_birth_date IS NOT NULL THEN
    BEGIN
      parsed_birth_date := meta_birth_date::date;
    EXCEPTION WHEN others THEN
      parsed_birth_date := NULL;
    END;
  END IF;

  -- Resolve a unique username. Profiles.username is UNIQUE since v0.9.4,
  -- so a colliding signup would otherwise abort the entire auth.users
  -- insert with "Database error saving new user".
  base_username := COALESCE(meta_username, split_part(NEW.email, '@', 1), 'user');
  base_username := substr(regexp_replace(base_username, '\s+', '_', 'g'), 1, 24);
  IF base_username IS NULL OR length(base_username) = 0 THEN
    base_username := 'user';
  END IF;
  candidate := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    attempt := attempt + 1;
    candidate := substr(base_username, 1, 20) || '_' || lpad(floor(random() * 9999)::int::text, 4, '0');
    EXIT WHEN attempt > 8;
  END LOOP;

  -- Last resort: fall back to user id suffix if all candidates collided
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) THEN
    candidate := base_username || '_' || substr(NEW.id::text, 1, 6);
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id, username, display_name, avatar_url, language, gender, birth_date
    )
    VALUES (
      NEW.id,
      candidate,
      COALESCE(meta_display_name, meta_username, split_part(NEW.email, '@', 1)),
      meta_avatar_url,
      'tr',
      meta_gender,
      parsed_birth_date
    );
  EXCEPTION WHEN unique_violation THEN
    -- Extremely unlikely race; insert with id-suffixed username.
    INSERT INTO public.profiles (
      id, username, display_name, avatar_url, language, gender, birth_date
    )
    VALUES (
      NEW.id,
      base_username || '_' || substr(NEW.id::text, 1, 8),
      COALESCE(meta_display_name, meta_username, split_part(NEW.email, '@', 1)),
      meta_avatar_url,
      'tr',
      meta_gender,
      parsed_birth_date
    );
  WHEN others THEN
    -- Never block the auth.users insert. Profile row will be backfilled
    -- by the existing safety triggers / clients on first authenticated
    -- request. Emit a NOTICE so we can find this in pg logs.
    RAISE NOTICE 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) Realtime publication + REPLICA IDENTITY FULL (idempotent)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'server_member_roles',
    'server_roles',
    'message_reports',
    'account_bans',
    'profiles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
          WHEN others THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3) Optional: surface account_bans to the *banned* user via realtime.
-- The existing RLS policy "Users can view own active account ban" already
-- restricts SELECT to auth.uid() = banned_user_id which is exactly what
-- we need; nothing extra to add here.
-- ---------------------------------------------------------------------
