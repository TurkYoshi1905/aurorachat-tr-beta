-- Fix: Supabase CDC DELETE events for message_reactions only include the
-- primary key by default. Setting REPLICA IDENTITY FULL ensures the full
-- row (message_id, emoji, user_id) is included in DELETE payloads, which
-- is required for real-time poll vote removal to work correctly.
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
