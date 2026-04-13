import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL = 15000;

export function useSpotifyPoller() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const brokenRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);

  const getSessionToken = async (): Promise<string | null> => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    sessionTokenRef.current = token;
    return token;
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

      if (data?.reason === 'token_invalid' || data?.reason === 'no_connection') {
        brokenRef.current = true;
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
    intervalRef.current = setInterval(() => poll(user.id), POLL_INTERVAL);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.unsubscribe();
    };
  }, [user?.id]);
}
