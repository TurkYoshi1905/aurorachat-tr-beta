
CREATE POLICY "Users can delete own DMs"
ON public.direct_messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

CREATE POLICY "Users can update own DMs"
ON public.direct_messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());
