import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceKeeper = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    const savedStatus = localStorage.getItem(`aurorachat_status_${userId}`) || 'online';
    // offline ise online'a çek, idle ise idle kalsın
    const status = savedStatus === 'offline' ? 'online' : savedStatus;

    // DB'ye online yaz ve last_seen güncelle
    const markOnline = () => {
      supabase
        .from('profiles')
        .update({ status: status as any, last_seen: new Date().toISOString() } as any)
        .eq('id', userId)
        .then(() => {});
    };

    // DB'ye offline yaz
    const markOffline = () => {
      navigator.sendBeacon
        ? supabase
            .from('profiles')
            .update({ status: 'offline' as any } as any)
            .eq('id', userId)
            .then(() => {})
        : null;
      supabase
        .from('profiles')
        .update({ status: 'offline' as any } as any)
        .eq('id', userId)
        .then(() => {});
    };

    // Supabase Presence kanalı (uygulama içi anlık durum için)
    const ch = supabase.channel('presence-room', { config: { presence: { key: userId } } });
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ status });
        markOnline();
      }
    });

    // Heartbeat: her 30 saniyede last_seen güncelle
    const heartbeat = setInterval(() => {
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() } as any)
        .eq('id', userId)
        .then(() => {});
    }, 30 * 1000);

    // Sayfa kapatılınca offline yap
    const handleBeforeUnload = () => markOffline();
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Sayfa gizlenince (başka sekme) offline, görününce online
    const handleVisibilityChange = () => {
      if (document.hidden) {
        supabase
          .from('profiles')
          .update({ status: 'offline' as any } as any)
          .eq('id', userId)
          .then(() => {});
      } else {
        markOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      markOffline();
    };
  }, [userId]);
};
