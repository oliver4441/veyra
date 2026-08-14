const DB_NAME = 'veyra-offline';
const DB_VERSION = 1;
const RESPONSES = 'responses';
const QUEUE = 'queue';

interface CachedResponse<T = unknown> {
  key: string;
  value: T;
  savedAt: number;
}

export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  createdAt: number;
}

function canUseIndexedDB() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDB()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESPONSES)) {
        db.createObjectStore(RESPONSES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

export async function cacheResponse<T>(key: string, value: T) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RESPONSES, 'readwrite');
      tx.objectStore(RESPONSES).put({ key, value, savedAt: Date.now() } satisfies CachedResponse<T>);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Offline storage is an enhancement; never break the request path.
  }
}

export async function getCachedResponse<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<T | null> {
  try {
    const db = await openDb();
    const entry = await new Promise<CachedResponse<T> | undefined>((resolve, reject) => {
      const request = db.transaction(RESPONSES, 'readonly').objectStore(RESPONSES).get(key);
      request.onsuccess = () => resolve(request.result as CachedResponse<T> | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!entry || Date.now() - entry.savedAt > maxAgeMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export async function queueRequest(request: Omit<QueuedRequest, 'id' | 'createdAt'>) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      tx.objectStore(QUEUE).put({
        ...request,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      } satisfies QueuedRequest);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best effort only.
  }
}

export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  try {
    const db = await openDb();
    const entries = await new Promise<QueuedRequest[]>((resolve, reject) => {
      const request = db.transaction(QUEUE, 'readonly').objectStore(QUEUE).getAll();
      request.onsuccess = () => resolve((request.result || []) as QueuedRequest[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return entries.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removeQueuedRequest(id: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      tx.objectStore(QUEUE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best effort only.
  }
}
