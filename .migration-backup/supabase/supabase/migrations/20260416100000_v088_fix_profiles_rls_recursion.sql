-- v0.8.8 FIX: Profiles RLS infinite recursion patch
-- Eğer v088 migration'ını zaten uyguladıysan ve 500 hatası alıyorsan
-- bu dosyayı Supabase SQL Editor'de çalıştır.
-- Bu migration ilk kez çalıştırıyorsan atlayabilirsin —
-- güncel 20260416000000_v088_reports_and_admin.sql zaten düzeltilmiş hali içeriyor.

-- 1. Önceki (recursive) politikaları kaldır
DROP POLICY IF EXISTS "App admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "App admins can update profiles" ON public.profiles;

-- 2. Security definer yardımcı fonksiyon oluştur
--    Bu fonksiyon profiles'ı RLS bypass ederek okur,
--    böylece politika içinde profiles sorgulayan sonsuz döngü oluşmaz.
CREATE OR REPLACE FUNCTION public.is_app_admin_check(user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_app_admin FROM public.profiles WHERE id = user_id),
    false
  );
$$;

-- 3. Güvenli politikaları yeniden oluştur
CREATE POLICY "App admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_app_admin_check(auth.uid())
  );

CREATE POLICY "App admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.is_app_admin_check(auth.uid())
  );

-- 4. message_reports politikalarını da düzelt (varsa)
DROP POLICY IF EXISTS "App admins can view all reports" ON public.message_reports;
DROP POLICY IF EXISTS "App admins can update reports" ON public.message_reports;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_reports') THEN
    EXECUTE $policy$
      CREATE POLICY "App admins can view all reports" ON public.message_reports
        FOR SELECT USING (public.is_app_admin_check(auth.uid()));
    $policy$;
    EXECUTE $policy$
      CREATE POLICY "App admins can update reports" ON public.message_reports
        FOR UPDATE USING (public.is_app_admin_check(auth.uid()));
    $policy$;
  END IF;
END$$;
