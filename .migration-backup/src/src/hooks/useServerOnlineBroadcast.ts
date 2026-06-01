import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Kullanıcının tüm sunuculardaki varlığını tek bir global presence kanalında yayınlar.
// ServerInviteEmbed bu kanalı dinleyerek anlık çevrimiçi sayısı gösterir.
export const useServerOnlineBroadcast = (
  userId: string | undefined,
  serverIds: string[],
  status: string,
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevKey = useRef('');

  useEffect(() => {
    if (!userId || serverIds.length === 0) return;

    const key = `${userId}|${serverIds.sort().join(',')}|${status}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const ch = supabase.channel('aurora-global-presence', {
      config: { presence: { key: userId } },
    });

    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ userId, serverIds, status });
      }
    });

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        prevKey.current = '';
      }
    };
  }, [userId, serverIds.join(','), status]);
};
