-- v1.1.5b: Fix announcement_comments DELETE RLS (42501 permission denied for table users)
-- Problem: previous policy used `FROM auth.users` which is not accessible from client-side RLS
-- Fix: use auth.email() built-in function or check via public.profiles

DROP POLICY IF EXISTS "comments_delete" ON public.announcement_comments;

CREATE POLICY "comments_delete" ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR auth.email() = 'asfurkan140@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_app_admin = true
    )
  );
