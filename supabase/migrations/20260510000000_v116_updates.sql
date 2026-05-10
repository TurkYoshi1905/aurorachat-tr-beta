-- v1.1.6 Database Updates
-- Dosya adı: 20260510000000_v116_updates.sql
-- Supabase SQL Editor'da çalıştır

-- ─────────────────────────────────────────────
-- 1. profiles: gender_visibility & birth_date_visibility kolonları
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender_visibility TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS birth_date_visibility TEXT NOT NULL DEFAULT 'everyone';

-- ─────────────────────────────────────────────
-- 2. server_members: order_index kolonu (sunucu sıralama)
-- ─────────────────────────────────────────────
ALTER TABLE public.server_members
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS server_members_order_idx
  ON public.server_members(user_id, order_index);

-- ─────────────────────────────────────────────
-- 3. profiles RLS – App Admin başkasının profilini güncelleyebilir
-- ─────────────────────────────────────────────
-- Önce eski çakışan politikaları kaldır
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "app_admins_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Kendi profilini ve adminlerin başkasının profilini güncellemesine izin ver
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_app_admin = true
    )
  );

-- ─────────────────────────────────────────────
-- 4. mod_role_assignments RLS güncelleme
-- ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.mod_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read mod_role_assignments" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Founders can manage mod_role_assignments" ON public.mod_role_assignments;
DROP POLICY IF EXISTS "Admins can manage mod_role_assignments" ON public.mod_role_assignments;

CREATE POLICY "Anyone can read mod_role_assignments" ON public.mod_role_assignments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage mod_role_assignments" ON public.mod_role_assignments
  FOR ALL
  USING (
    auth.email() = 'asfurkan140@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_app_admin = true
    )
  );

-- ─────────────────────────────────────────────
-- 5. banned_ips RLS güncelleme
-- ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.banned_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage banned_ips" ON public.banned_ips;
DROP POLICY IF EXISTS "Founders can manage banned_ips" ON public.banned_ips;

CREATE POLICY "Admins can manage banned_ips" ON public.banned_ips
  FOR ALL
  USING (
    auth.email() = 'asfurkan140@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_app_admin = true
    )
  );

-- ─────────────────────────────────────────────
-- 6. user_login_ips tablosu (kullanıcı IP takibi)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_login_ips (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address   TEXT        NOT NULL,
  user_agent   TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_login_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read user_login_ips" ON public.user_login_ips;
DROP POLICY IF EXISTS "Users can insert own ip" ON public.user_login_ips;

CREATE POLICY "Admins can read user_login_ips" ON public.user_login_ips
  FOR SELECT
  USING (
    auth.email() = 'asfurkan140@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_app_admin = true
    )
  );

CREATE POLICY "Users can insert own ip" ON public.user_login_ips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_login_ips_user_idx
  ON public.user_login_ips(user_id, recorded_at DESC);

-- ─────────────────────────────────────────────
-- 7. plugins tablosunda creator join için index
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS plugins_creator_id_idx ON public.plugins(creator_id);

-- ─────────────────────────────────────────────
-- 8. profiles okuma politikası (tüm kullanıcılar profil okuyabilsin)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles" ON public.profiles
  FOR SELECT USING (true);
