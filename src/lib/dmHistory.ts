const DB_NAME = 'aurorachat_dm_history';
const DB_VERSION = 1;
const STORE_NAME = 'dm_history';
const HIDDEN_STORE = 'hidden_dms';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        store.createIndex('lastAt', 'lastAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(HIDDEN_STORE)) {
        db.createObjectStore(HIDDEN_STORE, { keyPath: 'userId' });
      }
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

export async function saveDMHistory(entries: DMHistoryEntry[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const entry of entries) {
    store.put(entry);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDMHistory(): Promise<DMHistoryEntry[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      db.close();
      const entries = (req.result as DMHistoryEntry[]).sort((a, b) =>
        new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      );
      resolve(entries);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function hideDMFromHistory(userId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_NAME, HIDDEN_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).delete(userId);
  tx.objectStore(HIDDEN_STORE).put({ userId, hiddenAt: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getHiddenDMs(): Promise<Set<string>> {
  const db = await openDB();
  const tx = db.transaction(HIDDEN_STORE, 'readonly');
  const req = tx.objectStore(HIDDEN_STORE).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      db.close();
      resolve(new Set((req.result as { userId: string }[]).map(r => r.userId)));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function restoreDMFromHistory(userId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(HIDDEN_STORE, 'readwrite');
  tx.objectStore(HIDDEN_STORE).delete(userId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
