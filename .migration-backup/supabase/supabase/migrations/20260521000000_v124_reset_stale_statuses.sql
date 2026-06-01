-- ══════════════════════════════════════════════════════════════════
-- v1.2.4  Stale Status Auto-Reset
-- Eski "online/idle/dnd" durumlarını otomatik olarak "offline" yapar.
-- Heartbeat: usePresenceKeeper 5 dk'da bir last_seen günceller.
-- Eşik: 8 dk boyunca last_seen güncellenmemişse → offline.
-- ══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. pg_cron uzantısını etkinleştir (Supabase tüm planlarda mevcuttur)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ─────────────────────────────────────────────────────────────
-- 2. Eski durum sıfırlama fonksiyonu
--    RETURNS integer → kaç satır güncellendi
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_stale_online_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE profiles
  SET    status = 'offline'
  WHERE  status IN ('online', 'idle', 'dnd')
    AND  last_seen IS NOT NULL
    AND  last_seen < NOW() - INTERVAL '8 minutes';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_stale_online_statuses() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_stale_online_statuses() TO postgres;


-- ─────────────────────────────────────────────────────────────
-- 3. pg_cron job — her 5 dakikada bir çalışır
--    Varsa önce kaldır (idempotent migration için)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-stale-statuses') THEN
    PERFORM cron.unschedule('reset-stale-statuses');
  END IF;
END
$$;

SELECT cron.schedule(
  'reset-stale-statuses',       -- job adı
  '*/5 * * * *',                -- her 5 dakikada bir
  $$SELECT public.reset_stale_online_statuses()$$
);


-- ─────────────────────────────────────────────────────────────
-- 4. last_seen sütununa index (WHERE filtresi için)
--    Zaten varsa atla
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_status
  ON public.profiles (last_seen)
  WHERE status IN ('online', 'idle', 'dnd');
