-- v0.9.10: Safety-net migration for profile gender/birth_date columns.
--
-- Frontend AuthContext now selects `gender` and `birth_date` from `profiles`
-- so the Settings privacy cards can display the current value. These columns
-- were originally added in v0.8.9 (20260417000000_v089_gender_birthday_privacy.sql)
-- but this idempotent block ensures they exist on any environment that may have
-- skipped that migration (e.g. a freshly imported project) before code starts
-- selecting them.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS birth_date date;

-- Helpful indexes for moderation/analytics filtering (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles(birth_date);

COMMENT ON COLUMN public.profiles.gender IS
  'User gender: male / female / other / prefer_not_to_say. Editable via change_gender RPC (max 2/week).';
COMMENT ON COLUMN public.profiles.birth_date IS
  'User birth date (date). Editable via change_birth_date RPC (max 2/week, age 13-120).';
