import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL = 30000;
// Token yenilenebilir hatadan sonra kaç ms beklensin
const RETRY_AFTER_ERROR_MS = 60000;

export function useSpotifyPoller() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brokenRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);

  const getSessionToken = async (): Promise<string | null> => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    sessionTokenRef.current = token;
    return token;
  };

  const startPolling = (userId: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => poll(userId), POLL_INTERVAL);
  };

  const poll = async (userId: string) => {
    if (brokenRef.current) return;
    try {
      const accessToken = await getSessionToken();
      if (!accessToken) return;

      const { data, error } = await supabase.functions.invoke('spotify-token', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { action: 'poll', user_id: userId },
      });

      if (error) {
        console.warn('[SpotifyPoller] Edge function error:', error.message);
        return;
      }

      if (data?.reason === 'token_invalid') {
        // Spotify bağlantısı geçersiz — kalıcı olarak durdur
        brokenRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        console.warn('[SpotifyPoller] Token geçersiz, polling durduruldu.');
        return;
      }

      if (data?.reason === 'forbidden') {
        // 403: Spotify uygulaması dev modunda ya da kapsam eksik.
        // Polling'i 5 dakika boyunca durdur, bağlantıyı silme.
        if (intervalRef.current) clearInterval(intervalRef.current);
        console.warn('[SpotifyPoller] Spotify 403 — uygulama geliştirici modunda veya kapsam eksik. 5 dakika sonra tekrar denenecek.');
        retryTimeoutRef.current = setTimeout(() => {
          if (!brokenRef.current) {
            poll(userId);
            startPolling(userId);
          }
        }, 5 * 60 * 1000);
        return;
      }

      if (data?.reason === 'rate_limited') {
        // 429: Rate limit — Retry-After kadar bekle
        const waitMs = ((data.retry_after ?? 30) + 5) * 1000;
        if (intervalRef.current) clearInterval(intervalRef.current);
        console.warn(`[SpotifyPoller] Rate limit aşıldı. ${waitMs / 1000}s sonra tekrar denenecek.`);
        retryTimeoutRef.current = setTimeout(() => {
          if (!brokenRef.current) {
            poll(userId);
            startPolling(userId);
          }
        }, waitMs);
        return;
      }

      if (data?.reason === 'no_connection') {
        // Bağlantı hiç yok — polling'i durdur, 1 dakika sonra tekrar dene
        if (intervalRef.current) clearInterval(intervalRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          brokenRef.current = false;
          poll(userId);
          startPolling(userId);
        }, RETRY_AFTER_ERROR_MS);
        return;
      }

      if (data?.reason === 'api_error') {
        // Bilinmeyen geçici hata — bu turu atla, polling'e devam et
        console.warn(`[SpotifyPoller] Spotify API hatası (status: ${data.status ?? '?'}), sonraki turda tekrar denenecek.`);
        return;
      }
    } catch (err: any) {
      console.warn('[SpotifyPoller] Poll error:', err?.message);
    }
  };

  useEffect(() => {
    if (!user) return;
    brokenRef.current = false;
    sessionTokenRef.current = null;

    poll(user.id);
    startPolling(user.id);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
      if (session) {
        // Session yenilendiğinde poller'ı da sıfırla
        brokenRef.current = false;
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        startPolling(user.id);
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      subscription.unsubscribe();
    };
  }, [user?.id]);
}
