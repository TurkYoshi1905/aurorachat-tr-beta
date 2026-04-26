-- v0.9.5 — Bildirilerim gerçek zamanlı durum düzeltmesi
-- message_reports tablosunu Supabase Realtime yayınına ekle ve REPLICA IDENTITY FULL garantisi

-- REPLICA IDENTITY FULL: UPDATE/DELETE eventlarında tam row datası gönderilir
-- Bu olmazsa realtime filter (reporter_id=eq.X) UPDATE için çalışmaz
ALTER TABLE public.message_reports REPLICA IDENTITY FULL;

-- Realtime yayınına ekle (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
  END IF;
END$$;

-- RLS: reporter kendi bildirimlerini okuyabilsin (UPDATE sonrası da)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reports'
      AND policyname = 'Reporters can view own reports'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Reporters can view own reports"
        ON public.message_reports
        FOR SELECT
        USING (reporter_id = auth.uid());
    $policy$;
  END IF;
END$$;
