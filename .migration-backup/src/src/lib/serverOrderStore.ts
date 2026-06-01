const DB_NAME = 'aurorachat_db';
const DB_VERSION = 1;
const STORE_NAME = 'server_order';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveServerOrder(userId: string, orderIds: string[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ userId, orderIds, updatedAt: Date.now() });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
  }
}

export async function loadServerOrder(userId: string): Promise<string[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(userId);
    const result = await new Promise<any>((res) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
    db.close();
    return result?.orderIds ?? null;
  } catch {
    return null;
  }
}
