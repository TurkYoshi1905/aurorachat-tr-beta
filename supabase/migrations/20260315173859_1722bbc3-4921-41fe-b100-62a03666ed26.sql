
-- Phase A: Database Schema Migration for AuroraChat 1:1 Clone

-- 1. Alter profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS banner_color text DEFAULT '#1a1a2e',
  ADD COLUMN IF NOT EXISTS has_premium_badge boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'tr';

-- 2. Alter messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Alter channels table
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- 4. Alter servers table
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS icon text;

-- 5. Create channel_categories table
CREATE TABLE IF NOT EXISTS public.channel_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add FK from channels to channel_categories
ALTER TABLE public.channels
  ADD CONSTRAINT channels_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.channel_categories(id) ON DELETE SET NULL;

-- 6. Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- 7. Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- 8. Create threads table
CREATE TABLE IF NOT EXISTS public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 9. Create thread_messages table
CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.threads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL DEFAULT '',
  attachments jsonb DEFAULT '[]'::jsonb,
  inserted_at timestamptz DEFAULT now()
);

-- 10. Create server_roles table
CREATE TABLE IF NOT EXISTS public.server_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#99aab5',
  permissions jsonb DEFAULT '{}'::jsonb,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 11. Create server_member_roles table
CREATE TABLE IF NOT EXISTS public.server_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.server_members(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES public.server_roles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(member_id, role_id)
);

-- 12. Create server_bans table
CREATE TABLE IF NOT EXISTS public.server_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  banned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(server_id, user_id)
);

-- 13. Create server_emojis table
CREATE TABLE IF NOT EXISTS public.server_emojis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  image_url text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 14. Create server_invites table
CREATE TABLE IF NOT EXISTS public.server_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_uses integer,
  uses integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 15. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 16. Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  push_enabled boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  dm_notifications boolean DEFAULT true,
  mention_notifications boolean DEFAULT true,
  server_notifications boolean DEFAULT true
);

-- 17. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ========== RLS POLICIES ==========

-- channel_categories RLS
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by server members" ON public.channel_categories
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "Server owners can manage categories" ON public.channel_categories
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM servers WHERE id = channel_categories.server_id AND owner_id = auth.uid()));

-- friends RLS
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friends" ON public.friends
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users can send friend requests" ON public.friends
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own friend relations" ON public.friends
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users can delete own friend relations" ON public.friends
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());

-- message_reactions RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by channel members" ON public.message_reactions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id
    WHERE m.id = message_reactions.message_id AND is_server_member(auth.uid(), c.server_id)
  ));
CREATE POLICY "Users can add reactions" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions" ON public.message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- threads RLS
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Threads viewable by channel members" ON public.threads
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = threads.channel_id AND is_server_member(auth.uid(), c.server_id)
  ));
CREATE POLICY "Members can create threads" ON public.threads
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM channels c WHERE c.id = threads.channel_id AND is_server_member(auth.uid(), c.server_id)
  ));

-- thread_messages RLS
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread messages viewable by channel members" ON public.thread_messages
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM threads t JOIN channels c ON c.id = t.channel_id
    WHERE t.id = thread_messages.thread_id AND is_server_member(auth.uid(), c.server_id)
  ));
CREATE POLICY "Users can post thread messages" ON public.thread_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own thread messages" ON public.thread_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- server_roles RLS
ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles viewable by server members" ON public.server_roles
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "Server owners can manage roles" ON public.server_roles
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM servers WHERE id = server_roles.server_id AND owner_id = auth.uid()));

-- server_member_roles RLS
ALTER TABLE public.server_member_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Member roles viewable by server members" ON public.server_member_roles
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM server_members sm WHERE sm.id = server_member_roles.member_id AND is_server_member(auth.uid(), sm.server_id)
  ));

-- server_bans RLS
ALTER TABLE public.server_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bans viewable by server members" ON public.server_bans
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "Server owners can manage bans" ON public.server_bans
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM servers WHERE id = server_bans.server_id AND owner_id = auth.uid()));

-- server_emojis RLS
ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Emojis viewable by server members" ON public.server_emojis
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "Server owners can manage emojis" ON public.server_emojis
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM servers WHERE id = server_emojis.server_id AND owner_id = auth.uid()));

-- server_invites RLS
ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invites viewable by server members" ON public.server_invites
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "Invites viewable by code" ON public.server_invites
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can create invites" ON public.server_invites
  FOR INSERT TO authenticated WITH CHECK (is_server_member(auth.uid(), server_id));

-- notifications RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- notification_settings RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notification settings" ON public.notification_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own notification settings" ON public.notification_settings
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- audit_logs RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit logs viewable by server members" ON public.audit_logs
  FOR SELECT TO authenticated USING (is_server_member(auth.uid(), server_id));
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ========== UPDATE TRIGGER ==========

-- Update handle_new_user to populate display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    'tr'
  );
  RETURN NEW;
END;
$$;
