const DB_NAME = 'aurorachat_dm_history';
const DB_VERSION = 3;
const STORE_NAME = 'dm_history';
const HIDDEN_STORE = 'hidden_dms';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Recreate dm_history store with new keyPath if needed
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      store.createIndex('lastAt', 'lastAt', { unique: false });
      store.createIndex('currentUserId', 'currentUserId', { unique: false });

      // Recreate hidden_dms store with new keyPath if needed
      if (db.objectStoreNames.contains(HIDDEN_STORE)) {
        db.deleteObjectStore(HIDDEN_STORE);
      }
      db.createObjectStore(HIDDEN_STORE, { keyPath: 'cacheKey' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface DMHistoryEntry {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
}

export async function saveDMHistory(entries: DMHistoryEntry[], currentUserId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const entry of entries) {
    store.put({ ...entry, cacheKey: `${currentUserId}:${entry.userId}`, currentUserId });
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDMHistory(currentUserId: string): Promise<DMHistoryEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.index('currentUserId').getAll(currentUserId);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        db.close();
        const entries = (req.result as (DMHistoryEntry & { cacheKey: string; currentUserId: string })[])
          .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        resolve(entries);
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return [];
  }
}

export async function hideDMFromHistory(currentUserId: string, partnerUserId: string): Promise<void> {
  const db = await openDB();
  const cacheKey = `${currentUserId}:${partnerUserId}`;
  const tx = db.transaction([STORE_NAME, HIDDEN_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).delete(cacheKey);
  tx.objectStore(HIDDEN_STORE).put({ cacheKey, currentUserId, partnerUserId, hiddenAt: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getHiddenDMs(currentUserId: string): Promise<Set<string>> {
  try {
    const db = await openDB();
    const tx = db.transaction(HIDDEN_STORE, 'readonly');
    const req = tx.objectStore(HIDDEN_STORE).getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        db.close();
        const all = req.result as { cacheKey?: string; currentUserId?: string; partnerUserId?: string }[];
        const hidden = new Set<string>();
        for (const r of all) {
          if (r.currentUserId && r.currentUserId !== currentUserId) continue;
          if (r.partnerUserId) {
            hidden.add(r.partnerUserId);
          } else if (r.cacheKey && r.cacheKey.includes(':')) {
            hidden.add(r.cacheKey.split(':')[1]);
          }
        }
        resolve(hidden);
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return new Set();
  }
}

export async function restoreDMFromHistory(currentUserId: string, partnerUserId: string): Promise<void> {
  try {
    const db = await openDB();
    const cacheKey = `${currentUserId}:${partnerUserId}`;
    const tx = db.transaction(HIDDEN_STORE, 'readwrite');
    tx.objectStore(HIDDEN_STORE).delete(cacheKey);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Ignore errors on restore
  }
}
