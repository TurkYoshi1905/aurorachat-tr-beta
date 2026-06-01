-- v0.8.9: Add gender, birth_date, and visibility settings to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender_visibility text NOT NULL DEFAULT 'everyone' CHECK (gender_visibility IN ('everyone', 'friends', 'nobody')),
  ADD COLUMN IF NOT EXISTS birth_date_visibility text NOT NULL DEFAULT 'everyone' CHECK (birth_date_visibility IN ('everyone', 'friends', 'nobody'));

-- Allow users to update their own gender/birthday/visibility settings
CREATE POLICY IF NOT EXISTS "Users can update own gender and birthday"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
