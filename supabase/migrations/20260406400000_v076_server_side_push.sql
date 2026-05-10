-- v076: Server-side push notifications via pg_net
-- Ensures push notifications are sent from the database layer,
-- completely independent of whether the receiver's browser is active.

-- Enable pg_net extension for async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function that fires after a notification is inserted
-- Calls the send-push Edge Function via pg_net (async, non-blocking)
CREATE OR REPLACE FUNCTION public.handle_notification_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://ktittqaubkaylprxnoya.supabase.co/functions/v1/send-push',
    body    := jsonb_build_object(
                 'user_id', NEW.user_id::text,
                 'title',   NEW.title,
                 'body',    NEW.body,
                 'data',    COALESCE(NEW.data, '{}'::jsonb)
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aXR0cWF1YmtheWxwcnhub3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzI3NDAsImV4cCI6MjA4ODIwODc0MH0.nmgU8lXCueNmDyoDtX94x9uOAY9292ZTFaaXz8XI3dU'
               )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the original INSERT if push sending fails
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;

-- Trigger: after every notification insert → send push (server-side, browser-independent)
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_notification_push();
