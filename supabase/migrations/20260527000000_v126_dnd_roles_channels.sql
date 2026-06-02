-- v1.2.6: DnD Roller & Kanallar, InvitePage logo fix için ek index'ler
-- Roller ve kanallar sürükle-bırak sıralaması Supabase realtime sync

-- server_roles.position için ek index (realtime DnD güncellemeleri)
CREATE INDEX IF NOT EXISTS idx_server_roles_server_position
  ON server_roles (server_id, position);

-- channels.position için ek index (kanal DnD güncellemeleri)
CREATE INDEX IF NOT EXISTS idx_channels_server_category_position
  ON channels (server_id, category_id, position);

-- servers tablosunda icon alanı için index (InvitePage logo sorgusu)
CREATE INDEX IF NOT EXISTS idx_servers_id_icon
  ON servers (id) INCLUDE (name, icon);

-- server_roles realtime publication'a eklenmesi (zaten varsa atla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'server_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_roles;
  END IF;
END $$;
