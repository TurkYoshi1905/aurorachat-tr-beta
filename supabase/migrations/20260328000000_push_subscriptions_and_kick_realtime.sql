-- Create push_subscriptions table for Web Push API
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  auth text NOT NULL,
  p256dh text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Set REPLICA IDENTITY FULL on server_members so DELETE events carry full row data
-- This enables real-time kick detection on the client
ALTER TABLE server_members REPLICA IDENTITY FULL;

-- Set REPLICA IDENTITY FULL on blocked_users for real-time block sync
ALTER TABLE blocked_users REPLICA IDENTITY FULL;
