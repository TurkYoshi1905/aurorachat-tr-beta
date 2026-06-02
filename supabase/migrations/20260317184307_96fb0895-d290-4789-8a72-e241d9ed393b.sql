ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_afk boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS afk_reason text DEFAULT '';