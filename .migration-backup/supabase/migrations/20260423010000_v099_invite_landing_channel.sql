-- v0.9.9: Add landing_channel_id to server_invites so server owners
-- can choose which channel new members are dropped into when joining via invite.

ALTER TABLE public.server_invites
  ADD COLUMN IF NOT EXISTS landing_channel_id uuid
    REFERENCES public.channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_server_invites_landing_channel_id
  ON public.server_invites(landing_channel_id);

COMMENT ON COLUMN public.server_invites.landing_channel_id IS
  'Optional channel users land on after accepting this invite. NULL = default (first channel).';
