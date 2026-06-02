-- v1.0.0: Make handle_new_user trigger persist gender and birth_date from
-- the signup metadata so the ProfileCompletionModal does NOT appear for
-- users who already filled these fields during registration.
--
-- Background:
--   Register.tsx passes { display_name, username, gender, birth_date } via
--   supabase.auth.signUp(options.data). The handle_new_user trigger fires
--   inside auth and was only persisting display_name / username / avatar_url.
--   The follow-up client-side `update` from Register.tsx silently fails
--   because the user has no session yet (email not confirmed → RLS blocks
--   the anon update). So gender + birth_date were never written → the
--   "Profilini Tamamla" modal would pop on first login even though the user
--   filled those fields during signup.
--
-- This rewrite reads `gender` and `birth_date` straight from
-- NEW.raw_user_meta_data inside the SECURITY DEFINER trigger so the values
-- land in the profiles row at creation time, regardless of session state.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta_gender text;
  meta_birth_date text;
  parsed_birth_date date;
BEGIN
  meta_gender := NULLIF(NEW.raw_user_meta_data->>'gender', '');
  meta_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');

  -- Validate gender against allowed enum values; ignore otherwise
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

  INSERT INTO public.profiles (
    id, username, display_name, avatar_url, language, gender, birth_date
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    'tr',
    meta_gender,
    parsed_birth_date
  );

  RETURN NEW;
END;
$$;

-- Backfill: copy gender / birth_date from auth metadata for any existing user
-- whose profile row currently has those fields NULL. This rescues users who
-- registered between v0.8.9 (when the columns were added) and v1.0.0 (when
-- the trigger started writing them).
UPDATE public.profiles p
SET
  gender = COALESCE(
    p.gender,
    NULLIF(u.raw_user_meta_data->>'gender', '')
  ),
  birth_date = COALESCE(
    p.birth_date,
    CASE
      WHEN NULLIF(u.raw_user_meta_data->>'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (u.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END
  )
FROM auth.users u
WHERE p.id = u.id
  AND (p.gender IS NULL OR p.birth_date IS NULL)
  AND (
    NULLIF(u.raw_user_meta_data->>'gender', '') IS NOT NULL
    OR NULLIF(u.raw_user_meta_data->>'birth_date', '') IS NOT NULL
  )
  AND (
    -- Validate gender enum if we are about to write it
    p.gender IS NOT NULL
    OR NULLIF(u.raw_user_meta_data->>'gender', '') IN ('male', 'female', 'other', 'prefer_not_to_say')
    OR NULLIF(u.raw_user_meta_data->>'gender', '') IS NULL
  );
