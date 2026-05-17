import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    const getStatus = () => localStorage.getItem(`aurorachat_status_${userId}`) || 'online';

    const WRITE_COOLDOWN_MS = 5 * 60 * 1000; // 5 min — matches Index.tsx heartbeat interval

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

    // Supabase Presence channel — tracks online members without DB writes
    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        const status = getStatus() === 'offline' ? 'online' : getStatus();
        await ch.track({ status });
        markOnlineDB();
      }
    });

    // NOTE: The periodic heartbeat interval has been REMOVED here.
    // Index.tsx already runs a 5-minute setInterval that updates last_seen.
    // Having two intervals writing to the same column doubles DB writes for no benefit.
    // This hook now only handles: initial online mark, beforeunload offline mark,
    // and visibility-change events (re-mark online when tab becomes visible again).

    const handleBeforeUnload = () => markOfflineDB();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastWriteRef.current = 0; // reset so next online mark writes immediately
      } else {
        lastWriteRef.current = 0;
        markOnlineDB();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
};
