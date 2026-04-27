-- channels: slow mode
ALTER TABLE channels ADD COLUMN IF NOT EXISTS slow_mode_interval integer DEFAULT 0;

-- servers: welcome + word filter
ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_enabled boolean DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_channel_id uuid REFERENCES channels(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS word_filter jsonb DEFAULT '[]'::jsonb;

-- profiles: custom status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status text;