-- v1.1.1: Add code editor and commands support to bots table
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS commands JSONB DEFAULT '[]'::jsonb;
