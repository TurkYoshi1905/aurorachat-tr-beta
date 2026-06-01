-- v1.1.4: Bot üye listesi ve komut sistemi düzeltmeleri
-- Sorun 1: bots.commands NULL olduğunda custom komutlar çalışmıyor
-- Sorun 2: get_server_members_full hata alınca fallback bota yer vermiyor
-- Sorun 3: server_bots SELECT politikası SELECT için yeterince açık değil

-- ── 1. bots.commands: NULL değerleri [] yap, NOT NULL kısıtlaması ekle ──────
UPDATE public.bots SET commands = '[]'::jsonb WHERE commands IS NULL;
UPDATE public.bots SET code = '' WHERE code IS NULL;

ALTER TABLE public.bots
  ALTER COLUMN commands SET DEFAULT '[]'::jsonb,
  ALTER COLUMN commands SET NOT NULL;

ALTER TABLE public.bots
  ALTER COLUMN code SET DEFAULT '',
  ALTER COLUMN code SET NOT NULL;

-- ── 2. server_bots SELECT politikasını yeniden oluştur ───────────────────────
-- Herhangi bir authenticated kullanıcı kendi üyesi olduğu sunucudaki botları görebilmeli
DROP POLICY IF EXISTS "Members and bot owners can view server bots" ON public.server_bots;

CREATE POLICY "server_bots_select" ON public.server_bots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = server_bots.server_id
        AND sm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_bots.server_id
        AND s.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bots b
      WHERE b.id = server_bots.bot_id
        AND b.owner_id = auth.uid()
    )
  );

-- ── 3. bots SELECT politikası: herkes okuyabilsin (komut yürütme için gerekli) ──
DROP POLICY IF EXISTS "Anyone can view bots" ON public.bots;

CREATE POLICY "bots_select_all" ON public.bots
  FOR SELECT
  USING (true);

-- ── 4. get_server_members_full: EXCEPTION bloğu ekle ───────────────────────
-- Bot subquery'de hata oluşursa sadece insan üyeleri döndür (sessiz fail yerine)
CREATE OR REPLACE FUNCTION public.get_server_members_full(p_server_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(sub.row_data), '[]'::jsonb) INTO v_result
  FROM (
    -- ── İnsan üyeler ─────────────────────────────────────────────────
    SELECT
      jsonb_build_object(
        'member_id',        sm.id::text,
        'user_id',          sm.user_id::text,
        'username',         p.username,
        'display_name',     p.display_name,
        'avatar_url',       p.avatar_url,
        'status',           COALESCE(p.status, 'offline'),
        'bio',              p.bio,
        'banner_color',     p.banner_color,
        'is_premium',       COALESCE(p.is_premium, false),
        'has_premium_badge',COALESCE(p.has_premium_badge, false),
        'has_basic_badge',  COALESCE(p.has_basic_badge, false),
        'is_bot',           false,
        'last_seen',        p.last_seen,
        'platform',         p.platform,
        'roles', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',          sr.id::text,
              'name',        sr.name,
              'color',       sr.color,
              'position',    sr.position,
              'permissions', sr.permissions
            )
            ORDER BY sr.position DESC
          )
          FROM server_member_roles smr
          JOIN server_roles sr ON sr.id = smr.role_id
          WHERE smr.member_id = sm.id
        ), '[]'::jsonb)
      ) AS row_data
    FROM server_members sm
    JOIN profiles p ON p.id = sm.user_id
    WHERE sm.server_id = p_server_id

    UNION ALL

    -- ── Bot üyeler ────────────────────────────────────────────────────
    SELECT
      jsonb_build_object(
        'member_id',        sb.id::text,
        'user_id',          b.id::text,
        'username',         b.username,
        'display_name',     b.name,
        'avatar_url',       b.avatar_url,
        'status',           'online',
        'bio',              b.description,
        'banner_color',     null,
        'is_premium',       false,
        'has_premium_badge',false,
        'has_basic_badge',  false,
        'is_bot',           true,
        'last_seen',        null,
        'platform',         null,
        'roles', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',          sr.id::text,
              'name',        sr.name,
              'color',       sr.color,
              'position',    sr.position,
              'permissions', sr.permissions
            )
            ORDER BY sr.position DESC
          )
          FROM server_bot_roles sbr
          JOIN server_roles sr ON sr.id = sbr.role_id
          WHERE sbr.server_bot_id = sb.id
        ), '[]'::jsonb)
      ) AS row_data
    FROM server_bots sb
    JOIN bots b ON b.id = sb.bot_id
    WHERE sb.server_id = p_server_id
  ) sub;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Hata durumunda yalnızca insan üyeleri döndür (bot subquery başarısız olsa bile)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'member_id',        sm.id::text,
      'user_id',          sm.user_id::text,
      'username',         p.username,
      'display_name',     p.display_name,
      'avatar_url',       p.avatar_url,
      'status',           COALESCE(p.status, 'offline'),
      'bio',              p.bio,
      'banner_color',     p.banner_color,
      'is_premium',       COALESCE(p.is_premium, false),
      'has_premium_badge',COALESCE(p.has_premium_badge, false),
      'has_basic_badge',  COALESCE(p.has_basic_badge, false),
      'is_bot',           false,
      'last_seen',        p.last_seen,
      'platform',         p.platform,
      'roles',            '[]'::jsonb
    )
  ), '[]'::jsonb) INTO v_result
  FROM server_members sm
  JOIN profiles p ON p.id = sm.user_id
  WHERE sm.server_id = p_server_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_members_full(uuid) TO authenticated, anon;

-- ── 5. RPC: get_server_bot_commands — bir sunucudaki tüm bot komutlarını döndür ──
-- SlashCommandPopup'ın özel bot komutlarını göstermesi için gerekli
CREATE OR REPLACE FUNCTION public.get_server_bot_commands(p_server_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'bot_id',   b.id::text,
        'bot_name', b.name,
        'commands', COALESCE(b.commands, '[]'::jsonb)
      )
    )
    FROM server_bots sb
    JOIN bots b ON b.id = sb.bot_id
    WHERE sb.server_id = p_server_id
      AND jsonb_array_length(COALESCE(b.commands, '[]'::jsonb)) > 0
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_server_bot_commands(uuid) TO authenticated, anon;
