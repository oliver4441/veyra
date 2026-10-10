// ─────────────────────────────────────────────────────────────────────────────
// Download library persistence (IndexedDB)
// ─────────────────────────────────────────────────────────────────────────────
// Jobs survive reloads, app restarts and going offline, which is the whole
// point of a download queue: you should be able to close Veyra mid-download,
// reopen it on a plane, and see exactly where you left off.
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceProviderId } from '../sources/types';

export type DownloadState =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'handed-off' // browser took over the download (web build)
  | 'failed'
  | 'canceled';

export type DownloadKind = 'movie' | 'episode' | 'subtitle' | 'extra';

export interface DownloadItem {
  id: string;
  jobId: string;
  provider: SourceProviderId;
  sourceId: string;
  title: string;
  url: string;
  filename: string;
  mimeType?: string;
  quality?: string;
  sizeBytes?: number;
  durationSec?: number;
  posterUrl?: string;
  kind: DownloadKind;
  episodeNumber?: number;
  seasonNumber?: number;
  state: DownloadState;
  bytesWritten: number;
  totalBytes?: number;
  /** Absolute device path (native) — used for playback and deletion. */
  path?: string;
  /** URI a <video> element can actually load. */
  playableUrl?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface DownloadJob {
  id: string;
  provider: SourceProviderId;
  sourceId: string;
  title: string;
  posterUrl?: string;
  kind: 'movie' | 'series';
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
  state: DownloadState;
  /** Hidden from the Queue tab once the user clears it; files stay on disk. */
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  items: DownloadItem[];
}

const DB_NAME = 'veyra-downloads';
const DB_VERSION = 1;
const STORE = 'jobs';

function canUse(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUse()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = fn(store);
      tx.oncomplete = () => resolve(request && 'result' in request ? (request.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putJob(job: DownloadJob): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(job));
  } catch {
    // Persistence is best-effort; an in-memory queue still works this session.
  }
}

export async function getAllJobs(): Promise<DownloadJob[]> {
  try {
    const jobs = await withStore<DownloadJob[]>('readonly', (store) => store.getAll());
    return (jobs || []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getJob(id: string): Promise<DownloadJob | undefined> {
  try {
    return await withStore<DownloadJob>('readonly', (store) => store.get(id));
  } catch {
    return undefined;
  }
}

export async function removeJob(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(id));
  } catch {
    // ignore
  }
}

export async function clearAllJobs(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.clear());
  } catch {
    // ignore
  }
}

// ── Derived helpers ─────────────────────────────────────────────────────────

export function jobProgress(job: DownloadJob): { bytes: number; total: number; pct: number } {
  const bytes = job.items.reduce((sum, item) => sum + (item.bytesWritten || 0), 0);
  const total = job.items.reduce((sum, item) => sum + (item.totalBytes || item.sizeBytes || 0), 0);
  const pct = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : 0;
  return { bytes, total, pct };
}

export function jobCounts(job: DownloadJob) {
  const counts = { queued: 0, downloading: 0, paused: 0, completed: 0, failed: 0, canceled: 0 };
  job.items.forEach((item) => {
    if (item.state === 'completed' || item.state === 'handed-off') counts.completed += 1;
    else if (item.state === 'downloading') counts.downloading += 1;
    else if (item.state === 'paused') counts.paused += 1;
    else if (item.state === 'failed') counts.failed += 1;
    else if (item.state === 'canceled') counts.canceled += 1;
    else counts.queued += 1;
  });
  return counts;
}

export function rollupState(job: DownloadJob): DownloadState {
  const counts = jobCounts(job);
  if (job.items.length === 0) return 'queued';
  if (counts.downloading > 0) return 'downloading';
  if (counts.paused > 0) return 'paused';
  if (counts.failed > 0 && counts.completed === 0) return 'failed';
  if (counts.completed === job.items.length) return 'completed';
  if (counts.queued > 0) return 'queued';
  if (counts.failed > 0) return 'failed';
  return 'paused';
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
