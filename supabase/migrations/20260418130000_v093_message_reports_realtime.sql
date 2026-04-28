-- Enable Supabase Realtime for message_reports table
-- This allows real-time subscription on INSERT/UPDATE/DELETE events
-- filtered by reporter_id so users only receive their own report updates.

-- 1. Add message_reports to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE message_reports;

-- 2. Ensure RLS is enabled (belt-and-suspenders)
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;

-- 3. Policy: users can SELECT their own reports (needed for realtime filter)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reports'
      AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports"
      ON message_reports
      FOR SELECT
      USING (reporter_id = auth.uid());
  END IF;
END $$;

-- 4. Policy: users can INSERT their own reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reports'
      AND policyname = 'Users can insert own reports'
  ) THEN
    CREATE POLICY "Users can insert own reports"
      ON message_reports
      FOR INSERT
      WITH CHECK (reporter_id = auth.uid());
  END IF;
END $$;
