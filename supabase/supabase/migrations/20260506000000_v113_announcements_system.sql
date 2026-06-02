-- v1.1.3: Announcements system, server_bot_roles fix, server order, GroupDM presence

-- ── 1. server_bot_roles: Ensure table exists (fixes 42P01) ───────────────────
CREATE TABLE IF NOT EXISTS public.server_bot_roles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  server_bot_id uuid NOT NULL REFERENCES public.server_bots(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (server_bot_id, role_id)
);
ALTER TABLE public.server_bot_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "server_bot_roles_select" ON public.server_bot_roles;
CREATE POLICY "server_bot_roles_select" ON public.server_bot_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "server_bot_roles_insert" ON public.server_bot_roles;
CREATE POLICY "server_bot_roles_insert" ON public.server_bot_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.server_bots sb JOIN public.servers s ON s.id = sb.server_id WHERE sb.id = server_bot_roles.server_bot_id AND s.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "server_bot_roles_delete" ON public.server_bot_roles;
CREATE POLICY "server_bot_roles_delete" ON public.server_bot_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.server_bots sb JOIN public.servers s ON s.id = sb.server_id WHERE sb.id = server_bot_roles.server_bot_id AND s.owner_id = auth.uid())
);

-- ── 2. server_members: order_index column for drag-drop persistence ───────────
ALTER TABLE public.server_members ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_server_members_user_order ON public.server_members(user_id, order_index);

-- ── 3. Announcements table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content    text NOT NULL CHECK (char_length(content) >= 1),
  image_url  text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE USING (auth.uid() = author_id);

-- ── 4. Announcement comments table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content         text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  parent_id       uuid REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON public.announcement_comments;
CREATE POLICY "comments_select" ON public.announcement_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments_insert" ON public.announcement_comments;
CREATE POLICY "comments_insert" ON public.announcement_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "comments_delete" ON public.announcement_comments;
CREATE POLICY "comments_delete" ON public.announcement_comments FOR DELETE USING (auth.uid() = author_id OR
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email = 'asfurkan140@gmail.com')
);

-- ── 5. Realtime publications ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='announcements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='announcement_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_comments;
  END IF;
END $$;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.announcement_comments REPLICA IDENTITY FULL;

-- ── 6. RPC: get announcements with author profile ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_announcements_with_authors()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'content', a.content,
        'image_url', a.image_url,
        'author_id', a.author_id,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'author', jsonb_build_object(
          'display_name', COALESCE(p.display_name, p.username, 'Kullanıcı'),
          'username', COALESCE(p.username, ''),
          'avatar_url', p.avatar_url
        ),
        'comment_count', (SELECT COUNT(*) FROM public.announcement_comments c WHERE c.announcement_id = a.id)
      ) ORDER BY a.created_at DESC
    )
    FROM public.announcements a
    LEFT JOIN public.profiles p ON p.id = a.author_id
  ), '[]'::jsonb);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_announcements_with_authors() TO authenticated, anon;

-- ── 7. RPC: get comments for announcement ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_announcement_comments(p_announcement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'announcement_id', c.announcement_id,
        'content', c.content,
        'parent_id', c.parent_id,
        'author_id', c.author_id,
        'created_at', c.created_at,
        'author', jsonb_build_object(
          'display_name', COALESCE(p.display_name, p.username, 'Kullanıcı'),
          'username', COALESCE(p.username, ''),
          'avatar_url', p.avatar_url
        )
      ) ORDER BY c.created_at ASC
    )
    FROM public.announcement_comments c
    LEFT JOIN public.profiles p ON p.id = c.author_id
    WHERE c.announcement_id = p_announcement_id
  ), '[]'::jsonb);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_announcement_comments(uuid) TO authenticated, anon;

-- ── 8. get_server_members_full: final safe version ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(sub.row_data)
    FROM (
      SELECT jsonb_build_object(
        'member_id', sm.id::text, 'user_id', sm.user_id::text,
        'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
        'status', COALESCE(p.status,'offline'), 'bio', p.bio, 'banner_color', p.banner_color,
        'is_premium', COALESCE(p.is_premium,false), 'has_premium_badge', COALESCE(p.has_premium_badge,false),
        'has_basic_badge', COALESCE(p.has_basic_badge,false), 'is_bot', false,
        'last_seen', p.last_seen, 'platform', p.platform,
        'roles', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id',sr.id::text,'name',sr.name,'color',sr.color,'position',sr.position,'permissions',sr.permissions) ORDER BY sr.position DESC)
          FROM server_member_roles smr JOIN server_roles sr ON sr.id = smr.role_id WHERE smr.member_id = sm.id
        ), '[]'::jsonb)
      ) AS row_data
      FROM server_members sm JOIN profiles p ON p.id = sm.user_id WHERE sm.server_id = p_server_id
      UNION ALL
      SELECT jsonb_build_object(
        'member_id', sb.id::text, 'user_id', b.id::text,
        'username', b.username, 'display_name', b.name, 'avatar_url', b.avatar_url,
        'status', 'online', 'bio', b.description, 'banner_color', null,
        'is_premium', false, 'has_premium_badge', false, 'has_basic_badge', false, 'is_bot', true,
        'last_seen', null, 'platform', null,
        'roles', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id',sr.id::text,'name',sr.name,'color',sr.color,'position',sr.position,'permissions',sr.permissions) ORDER BY sr.position DESC)
          FROM server_bot_roles sbr JOIN server_roles sr ON sr.id = sbr.role_id WHERE sbr.server_bot_id = sb.id
        ), '[]'::jsonb)
      ) AS row_data
      FROM server_bots sb JOIN bots b ON b.id = sb.bot_id WHERE sb.server_id = p_server_id
    ) sub
  ), '[]'::jsonb);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO authenticated, anon;
