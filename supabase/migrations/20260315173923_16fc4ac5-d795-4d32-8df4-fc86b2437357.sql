
-- Fix overly permissive INSERT policies

-- notifications: only allow inserting notifications for yourself or via server context
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- audit_logs: only server members can insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Server members can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (is_server_member(auth.uid(), server_id));
