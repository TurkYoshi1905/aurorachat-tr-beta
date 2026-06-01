type CacheEntry<T> = { data: T; expiresAt: number };

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pending = new Map<string, Promise<any>>();
  private defaultTTL: number;

  constructor(defaultTTL = 30_000) {
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return undefined; }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + (ttl ?? this.defaultTTL) });
  }

  invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
  }

  async fetch<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const promise = fetcher().then(data => {
      this.set(key, data, ttl);
      this.pending.delete(key);
      return data;
    }).catch(err => { this.pending.delete(key); throw err; });
    this.pending.set(key, promise);
    return promise;
  }
}

export const appCache = new QueryCache(30_000);

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
