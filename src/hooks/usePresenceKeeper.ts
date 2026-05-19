import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  const lastWriteRef = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const getStatus = () => localStorage.getItem(`aurorachat_status_${userId}`) || 'online';

    const WRITE_COOLDOWN_MS = 5 * 60 * 1000; // 5 min
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min of inactivity → idle

    const writeStatus = (status: string) => {
      supabase
        .from('profiles')
        .update({ status: status as any, last_seen: new Date().toISOString() } as any)
        .eq('id', userId)
        .then(() => {});
    };

    const markOnlineDB = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_COOLDOWN_MS) return;
      lastWriteRef.current = now;
      const s = getStatus();
      const effectiveStatus = s === 'offline' ? 'online' : s;
      writeStatus(effectiveStatus);
    };

    const markOfflineDB = () => {
      writeStatus('offline');
    };

    const markIdleDB = () => {
      const s = getStatus();
      // Only go idle if the user is currently 'online' (not DND, not already offline)
      if (s === 'online') {
        isIdleRef.current = true;
        writeStatus('idle');
      }
    };

    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // If we were idle, restore to online
      if (isIdleRef.current) {
        const s = getStatus();
        if (s === 'online') {
          isIdleRef.current = false;
          lastWriteRef.current = 0;
          markOnlineDB();
        }
      }
      idleTimerRef.current = setTimeout(markIdleDB, IDLE_TIMEOUT_MS);
    };

    // Supabase Presence channel
    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        const status = getStatus() === 'offline' ? 'online' : getStatus();
        await ch.track({ status });
        markOnlineDB();
      }
    });

    const handleBeforeUnload = () => markOfflineDB();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab went to background → mark idle
        lastWriteRef.current = 0;
        const s = getStatus();
        if (s === 'online') {
          isIdleRef.current = true;
          writeStatus('idle');
        }
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      } else {
        // Tab came back → restore online
        lastWriteRef.current = 0;
        if (isIdleRef.current) {
          isIdleRef.current = false;
          const s = getStatus();
          if (s === 'online') writeStatus('online');
        }
        markOnlineDB();
        resetIdle();
      }
    };

    const handleActivity = () => resetIdle();

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity, { passive: true });
    document.addEventListener('keydown', handleActivity, { passive: true });
    document.addEventListener('touchstart', handleActivity, { passive: true });

    // Start idle timer
    resetIdle();

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [userId]);
};
