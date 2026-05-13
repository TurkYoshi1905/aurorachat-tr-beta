-- v1.1.7: Profile Banner URL + Mod Role RLS Fix + Profiles Admin Update Fix
-- Run in Supabase SQL Editor

-- 1. Add banner_url column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT NULL;

-- 2. Create storage bucket for profile banners
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-banners',
  'profile-banners',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for profile-banners bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view profile banners' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can view profile banners" ON storage.objects
      FOR SELECT USING (bucket_id = 'profile-banners');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can upload own banner' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can upload own banner" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'profile-banners'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own banner' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own banner" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'profile-banners'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own banner' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own banner" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'profile-banners'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- 4. Fix mod_role_assignments RLS — allow app admins and founder to INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can manage mod roles" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can insert mod roles" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can update mod roles" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can delete mod roles" ON public.mod_role_assignments;

CREATE POLICY "Admins can manage mod roles" ON public.mod_role_assignments
  FOR ALL
  USING (
    auth.role() = 'authenticated' AND (
      auth.email() = 'asfurkan140@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      auth.email() = 'asfurkan140@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_app_admin = true
      )
    )
  );

-- 5. Fix profiles RLS — app admins can update any profile (fixes 403 on admin panel)
DROP POLICY IF EXISTS "App admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users or admins can update profile" ON public.profiles
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = id
      OR auth.email() = 'asfurkan140@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.is_app_admin = true
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      auth.uid() = id
      OR auth.email() = 'asfurkan140@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.is_app_admin = true
      )
    )
  );

-- 6. Ensure profiles uses REPLICA IDENTITY FULL for realtime banner updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
