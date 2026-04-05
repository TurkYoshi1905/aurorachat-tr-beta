import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;
    const savedStatus = localStorage.getItem(`aurorachat_status_${userId}`) || 'online';
    const status = savedStatus === 'offline' ? 'online' : savedStatus;
    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await ch.track({ status });
    });
    return () => { supabase.removeChannel(ch); };
  }, [userId]);
};
