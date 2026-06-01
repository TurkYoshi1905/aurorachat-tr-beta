interface RateLimitEntry {
  timestamps: number[];
  cooldownUntil: number | null;
}

const store = new Map<string, RateLimitEntry>();

const MESSAGE_LIMIT = 6;
const MESSAGE_WINDOW_MS = 1000;
const COOLDOWN_MS = 30 * 60 * 1000;

const AUTH_LIMIT = 5;
const AUTH_WINDOW_MS = 60 * 1000;

function getEntry(key: string): RateLimitEntry {
  if (!store.has(key)) {
    store.set(key, { timestamps: [], cooldownUntil: null });
  }
  return store.get(key)!;
}

export function checkMessageRateLimit(userId: string): { allowed: boolean; cooldownMs?: number } {
  const key = `msg:${userId}`;
  const entry = getEntry(key);
  const now = Date.now();

  if (entry.cooldownUntil && now < entry.cooldownUntil) {
    return { allowed: false, cooldownMs: entry.cooldownUntil - now };
  }
  if (entry.cooldownUntil && now >= entry.cooldownUntil) {
    entry.cooldownUntil = null;
    entry.timestamps = [];
  }

  entry.timestamps = entry.timestamps.filter(t => now - t < MESSAGE_WINDOW_MS);
  entry.timestamps.push(now);

  if (entry.timestamps.length > MESSAGE_LIMIT) {
    entry.cooldownUntil = now + COOLDOWN_MS;
    entry.timestamps = [];
    return { allowed: false, cooldownMs: COOLDOWN_MS };
  }

  return { allowed: true };
}

export function checkAuthRateLimit(key: string): { allowed: boolean; waitMs?: number } {
  const storeKey = `auth:${key}`;
  const entry = getEntry(storeKey);
  const now = Date.now();

  entry.timestamps = entry.timestamps.filter(t => now - t < AUTH_WINDOW_MS);
  entry.timestamps.push(now);

  if (entry.timestamps.length > AUTH_LIMIT) {
    const oldestInWindow = entry.timestamps[0];
    const waitMs = AUTH_WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, waitMs: Math.max(0, waitMs) };
  }

  return { allowed: true };
}

export function isInCooldown(userId: string): { inCooldown: boolean; remainingMs?: number } {
  const key = `msg:${userId}`;
  const entry = store.get(key);
  if (!entry?.cooldownUntil) return { inCooldown: false };
  const now = Date.now();
  if (now >= entry.cooldownUntil) {
    entry.cooldownUntil = null;
    return { inCooldown: false };
  }
  return { inCooldown: true, remainingMs: entry.cooldownUntil - now };
}

export function liftLocalCooldown(userId: string): void {
  const key = `msg:${userId}`;
  const entry = store.get(key);
  if (entry) {
    entry.cooldownUntil = null;
    entry.timestamps = [];
  }
}

export function formatCooldownTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours}sa ${rem}dk` : `${hours}sa`;
  }
  return `${minutes}dk`;
}
