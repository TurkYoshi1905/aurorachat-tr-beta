import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActiveCooldown {
  id: string;
  reason: string | null;
  cooldown_until: string;
  source: 'manual' | 'auto';
}

export function useCooldown() {
  const { user } = useAuth();
  const [activeCooldown, setActiveCooldown] = useState<ActiveCooldown | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user) { setActiveCooldown(null); setLoading(false); return; }
    try {
      const now = new Date().toISOString();

      const { data: manual } = await (supabase as any)
        .from('user_cooldowns')
        .select('id, reason, cooldown_until')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('cooldown_until', now)
        .order('cooldown_until', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (manual) {
        setActiveCooldown({ ...manual, source: 'manual' as const });
        setLoading(false);
        return;
      }

      const { data: auto } = await (supabase as any)
        .from('rate_limit_cooldowns')
        .select('id, cooldown_until, reason')
        .eq('user_id', user.id)
        .gt('cooldown_until', now)
        .order('cooldown_until', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (auto) {
        setActiveCooldown({ ...auto, reason: auto.reason || 'Otomatik rate limit', source: 'auto' as const });
        setLoading(false);
        return;
      }

      setActiveCooldown(null);
    } catch {
      setActiveCooldown(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    check();
    if (!user) return;

    const ch = supabase
      .channel(`cooldown-watch-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_cooldowns', filter: `user_id=eq.${user.id}` }, check)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rate_limit_cooldowns', filter: `user_id=eq.${user.id}` }, check)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, check]);

  const remainingMs = activeCooldown
    ? Math.max(0, new Date(activeCooldown.cooldown_until).getTime() - Date.now())
    : 0;

  return {
    activeCooldown,
    isOnCooldown: activeCooldown !== null && remainingMs > 0,
    remainingMs,
    remainingMinutes: Math.ceil(remainingMs / 60000),
    loading,
    refetch: check,
  };
}
