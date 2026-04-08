import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;
    const savedStatus = localStorage.getItem(`aurorachat_status_${userId}`) || 'online';
    // 'offline' and 'idle' are reset to 'online' on reconnect
    const status = (savedStatus === 'offline' || savedStatus === 'idle') ? 'online' : savedStatus;
    if (savedStatus === 'idle') {
      localStorage.setItem(`aurorachat_status_${userId}`, 'online');
    }
    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await ch.track({ status });
    });
    return () => { supabase.removeChannel(ch); };
  }, [userId]);
};
