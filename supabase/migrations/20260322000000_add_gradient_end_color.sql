ALTER TABLE public.server_roles
ADD COLUMN IF NOT EXISTS gradient_end_color TEXT DEFAULT NULL;
