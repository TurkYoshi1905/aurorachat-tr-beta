-- =====================================================================
-- AuroraChat v0.9.8 migration
-- 1) profile_change_log table to enforce 2-changes-per-week limit
--    for `gender` and `birth_date` fields on profiles.
-- 2) Server-side RPC functions: change_gender(p_value), change_birth_date(p_value)
-- 3) Re-confirm REPLICA IDENTITY FULL + realtime publication for message_reports
--    so Bildirilerim status updates (pending -> rejected/approved) propagate live.
--
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profile_change_log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('gender', 'birth_date')),
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_change_log_user_field_time
  ON public.profile_change_log (user_id, field, changed_at DESC);

ALTER TABLE public.profile_change_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own change log; the RPC writes via SECURITY DEFINER.
DROP POLICY IF EXISTS "profile_change_log_select_own" ON public.profile_change_log;
CREATE POLICY "profile_change_log_select_own"
  ON public.profile_change_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Block direct INSERT/UPDATE/DELETE from clients - only RPCs may write.
DROP POLICY IF EXISTS "profile_change_log_no_client_writes" ON public.profile_change_log;
CREATE POLICY "profile_change_log_no_client_writes"
  ON public.profile_change_log
  FOR INSERT
  WITH CHECK (false);

-- ---------------------------------------------------------------------
-- 2) RPC functions (SECURITY DEFINER) with 2/week enforcement
-- ---------------------------------------------------------------------

-- change_gender(p_value text)
CREATE OR REPLACE FUNCTION public.change_gender(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_old text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_value IS NULL OR p_value NOT IN ('male', 'female', 'other', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'invalid_value';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.profile_change_log
  WHERE user_id = v_uid
    AND field = 'gender'
    AND changed_at > now() - interval '7 days';

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'weekly_limit_reached';
  END IF;

  SELECT gender INTO v_old FROM public.profiles WHERE id = v_uid;

  -- Skip recording / count usage when no actual change.
  IF v_old IS NOT DISTINCT FROM p_value THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET gender = p_value, updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.profile_change_log (user_id, field, old_value, new_value)
  VALUES (v_uid, 'gender', v_old, p_value);
END;
$$;

-- change_birth_date(p_value text) - p_value must be ISO YYYY-MM-DD
CREATE OR REPLACE FUNCTION public.change_birth_date(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_old date;
  v_new date;
  v_age numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  BEGIN
    v_new := p_value::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_value';
  END;

  v_age := EXTRACT(EPOCH FROM (now() - v_new::timestamptz)) / (365.25 * 24 * 3600);
  IF v_age < 13 OR v_age > 120 THEN
    RAISE EXCEPTION 'invalid_value';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.profile_change_log
  WHERE user_id = v_uid
    AND field = 'birth_date'
    AND changed_at > now() - interval '7 days';

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'weekly_limit_reached';
  END IF;

  SELECT birth_date INTO v_old FROM public.profiles WHERE id = v_uid;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET birth_date = v_new, updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.profile_change_log (user_id, field, old_value, new_value)
  VALUES (v_uid, 'birth_date', v_old::text, v_new::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_gender(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_birth_date(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3) Re-confirm message_reports realtime (idempotent)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_reports') THEN
    EXECUTE 'ALTER TABLE public.message_reports REPLICA IDENTITY FULL';
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;
