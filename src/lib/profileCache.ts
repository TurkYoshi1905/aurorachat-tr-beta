import { supabase } from '@/integrations/supabase/client';

interface CachedProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  online_status: string | null;
  fetchedAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, CachedProfile>();

export async function getCachedProfile(userId: string): Promise<CachedProfile | null> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, banner_url, bio, online_status')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  const profile: CachedProfile = {
    ...(data as unknown as Omit<CachedProfile, 'fetchedAt'>),
    fetchedAt: Date.now(),
  };
  cache.set(userId, profile);
  return profile;
}

export function invalidateProfileCache(userId: string) {
  cache.delete(userId);
}

export function prefetchProfiles(userIds: string[]) {
  const uncached = userIds.filter(id => {
    const c = cache.get(id);
    return !c || Date.now() - c.fetchedAt >= TTL_MS;
  });
  if (uncached.length === 0) return;

  supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, banner_url, bio, online_status')
    .in('id', uncached)
    .then(({ data }) => {
      if (!data) return;
      const now = Date.now();
      for (const row of data) {
        cache.set(row.id, { ...(row as unknown as Omit<CachedProfile, 'fetchedAt'>), fetchedAt: now });
      }
    });
}
