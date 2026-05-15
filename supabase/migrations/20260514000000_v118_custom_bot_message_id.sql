-- v1.1.8: Add bot_id column to messages table
-- Links custom bot messages to their bot record for proper BotProfileModal routing

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES bots(id) ON DELETE SET NULL;

-- Index for efficient bot message lookup
CREATE INDEX IF NOT EXISTS idx_messages_bot_id ON messages(bot_id) WHERE bot_id IS NOT NULL;

-- Allow reading bot_id in all message queries (inherits existing messages RLS)
COMMENT ON COLUMN messages.bot_id IS 'Links bot-generated messages to the custom bot that produced them. NULL for AuroraChat system bot messages.';
