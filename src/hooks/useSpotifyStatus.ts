import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SpotifyNowPlaying {
  is_playing: boolean;
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  album_art_url: string | null;
  track_url: string | null;
  progress_ms: number;
  duration_ms: number;
}

/**
 * useSpotifyStatus
 *
 * Belirli bir kullanıcının Spotify müzik durumunu Supabase Realtime üzerinden
 * Discord tarzında gerçek zamanlı izler.
 *
 * @param userId  Profil kartı açılan kullanıcının ID'si
 * @param enabled Sadece panel/kart açıkken true yapın (gereksiz sorguları önler)
 */
export function useSpotifyStatus(userId: string | null, enabled: boolean) {
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null>(null);
  const [localProgressMs, setLocalProgressMs] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // İlk veri çekimi + Realtime aboneliği
  useEffect(() => {
    if (!userId || !enabled) {
      setNowPlaying(null);
      setLocalProgressMs(0);
      return;
    }

    let cancelled = false;

    const fetchInitial = async () => {
      const { data } = await (supabase.from('spotify_now_playing') as any)
        .select('is_playing, track_name, artist_name, album_name, album_art_url, track_url, progress_ms, duration_ms')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (data?.is_playing) {
        setNowPlaying(data as SpotifyNowPlaying);
        setLocalProgressMs(data.progress_ms ?? 0);
      } else {
        setNowPlaying(null);
        setLocalProgressMs(0);
      }
    };

    fetchInitial();

    const ch = supabase
      .channel(`spotify-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spotify_now_playing',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          const d = payload.new as any;
          if (d?.is_playing) {
            setNowPlaying(d as SpotifyNowPlaying);
            setLocalProgressMs(d.progress_ms ?? 0);
          } else {
            setNowPlaying(null);
            setLocalProgressMs(0);
          }
        },
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, enabled]);

  // İlerleme çubuğu için saniye bazlı yerel ticker
  useEffect(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }

    if (nowPlaying?.is_playing) {
      tickerRef.current = setInterval(() => {
        setLocalProgressMs((prev) => {
          if (nowPlaying.duration_ms > 0 && prev >= nowPlaying.duration_ms) return prev;
          return prev + 1000;
        });
      }, 1000);
    }

    return () => {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [nowPlaying?.is_playing, nowPlaying?.track_name]);

  return { nowPlaying, localProgressMs };
}
