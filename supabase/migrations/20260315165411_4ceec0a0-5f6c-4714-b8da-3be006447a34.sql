
-- Create enums
CREATE TYPE public.user_status AS ENUM ('online', 'offline', 'idle', 'dnd');
CREATE TYPE public.channel_type AS ENUM ('text', 'voice');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  status user_status NOT NULL DEFAULT 'offline',
  bio TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Servers table
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server members table
CREATE TABLE public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, user_id)
);

-- Channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type channel_type NOT NULL DEFAULT 'text',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL DEFAULT '',
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DM conversations table
CREATE TABLE public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Direct messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB DEFAULT '[]'::jsonb,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_messages_channel ON public.messages(channel_id, inserted_at DESC);
CREATE INDEX idx_messages_parent ON public.messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_server_members_user ON public.server_members(user_id);
CREATE INDEX idx_server_members_server ON public.server_members(server_id);
CREATE INDEX idx_channels_server ON public.channels(server_id);
CREATE INDEX idx_direct_messages_conv ON public.direct_messages(conversation_id, inserted_at DESC);
CREATE INDEX idx_dm_conversations_user1 ON public.dm_conversations(user1_id);
CREATE INDEX idx_dm_conversations_user2 ON public.dm_conversations(user2_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function: check server membership
CREATE OR REPLACE FUNCTION public.is_server_member(_user_id UUID, _server_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE user_id = _user_id AND server_id = _server_id
  );
$$;

-- Helper: check if user is in DM conversation
CREATE OR REPLACE FUNCTION public.is_dm_participant(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_conversations
    WHERE id = _conversation_id AND (_user_id = user1_id OR _user_id = user2_id)
  );
$$;

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- RLS: servers
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Servers viewable by members" ON public.servers
  FOR SELECT TO authenticated USING (public.is_server_member(auth.uid(), id));
CREATE POLICY "Anyone can create servers" ON public.servers
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Server owners can update" ON public.servers
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Server owners can delete" ON public.servers
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
-- Allow viewing servers by invite code for joining
CREATE POLICY "Servers viewable by invite code" ON public.servers
  FOR SELECT TO authenticated USING (true);

-- RLS: server_members
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by server members" ON public.server_members
  FOR SELECT TO authenticated USING (public.is_server_member(auth.uid(), server_id));
CREATE POLICY "Users can join servers" ON public.server_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave servers" ON public.server_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS: channels
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels viewable by server members" ON public.channels
  FOR SELECT TO authenticated USING (public.is_server_member(auth.uid(), server_id));
CREATE POLICY "Server owners can manage channels" ON public.channels
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
  );
CREATE POLICY "Server owners can update channels" ON public.channels
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
  );
CREATE POLICY "Server owners can delete channels" ON public.channels
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
  );

-- RLS: messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by channel server members" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id AND public.is_server_member(auth.uid(), c.server_id)
    )
  );
CREATE POLICY "Authenticated users can send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id AND public.is_server_member(auth.uid(), c.server_id)
    )
  );
CREATE POLICY "Users can edit own messages" ON public.messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own messages" ON public.messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS: dm_conversations
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DM conversations viewable by participants" ON public.dm_conversations
  FOR SELECT TO authenticated USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Users can create DM conversations" ON public.dm_conversations
  FOR INSERT TO authenticated WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- RLS: direct_messages
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DMs viewable by conversation participants" ON public.direct_messages
  FOR SELECT TO authenticated USING (public.is_dm_participant(auth.uid(), conversation_id));
CREATE POLICY "Users can send DMs" ON public.direct_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND public.is_dm_participant(auth.uid(), conversation_id)
  );

-- Enable realtime for messages and direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage RLS for chat-attachments
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('chat-attachments', 'avatars'));
CREATE POLICY "Anyone can view attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id IN ('chat-attachments', 'avatars'));
CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id IN ('chat-attachments', 'avatars') AND (storage.foldername(name))[1] = auth.uid()::text);

-- Auto-create general channel when server is created
CREATE OR REPLACE FUNCTION public.handle_new_server()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add owner as member
  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  -- Create default general channel
  INSERT INTO public.channels (server_id, name, type, position)
  VALUES (NEW.id, 'genel', 'text', 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_server_created
  AFTER INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_server();
