-- MFA Trusted Devices: sunucu tarafında 30 günlük güven kaydı

CREATE TABLE IF NOT EXISTS public.mfa_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  trusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mfa_trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanici kendi guvenen cihazlarini gorebilir"
  ON public.mfa_trusted_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Kullanici kendi cihazini ekleyebilir"
  ON public.mfa_trusted_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanici kendi cihazini silebilir"
  ON public.mfa_trusted_devices FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS mfa_trusted_devices_lookup_idx
  ON public.mfa_trusted_devices(user_id, factor_id, session_key);

-- Süresi dolmuş kayıtları temizleyen fonksiyon
CREATE OR REPLACE FUNCTION public.cleanup_expired_mfa_trusted_devices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.mfa_trusted_devices WHERE expires_at < NOW();
END;
$$;
