import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    const getStatus = () => localStorage.getItem(`aurorachat_status_${userId}`) || 'online';

    const WRITE_COOLDOWN_MS = 3 * 60 * 1000;

    const markOnlineDB = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_COOLDOWN_MS) return;
      lastWriteRef.current = now;
      const status = getStatus() === 'offline' ? 'online' : getStatus();
      supabase
        .from('profiles')
        .update({ status: status as any, last_seen: new Date().toISOString() } as any)
        .eq('id', userId)
        .then(() => {});
    };

    const markOfflineDB = () => {
      supabase
        .from('profiles')
        .update({ status: 'offline' as any } as any)
        .eq('id', userId)
        .then(() => {});
    };

    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        const status = getStatus() === 'offline' ? 'online' : getStatus();
        await ch.track({ status });
        markOnlineDB();
      }
    });

    const heartbeat = setInterval(() => {
      if (document.hidden) return;
      markOnlineDB();
    }, 3 * 60 * 1000);

    const handleBeforeUnload = () => markOfflineDB();

    // Visibility change: Index.tsx already handles idle/online transitions
    // and writes to DB — do NOT write offline here to avoid race condition.
    // Only reset the cooldown so the next markOnlineDB call writes immediately.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastWriteRef.current = 0;
      } else {
        lastWriteRef.current = 0; // force immediate write on return
        markOnlineDB();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Do NOT call markOfflineDB() here — this cleanup runs on every
      // React unmount (Settings→Index navigation etc.) and would incorrectly
      // mark the user offline. Only beforeunload handles true page-close.
    };
  }, [userId]);
};
