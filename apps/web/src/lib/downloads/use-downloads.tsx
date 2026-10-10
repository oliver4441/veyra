'use client';

// ─────────────────────────────────────────────────────────────────────────────
// React bindings for the download manager
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getDownloadManager, type DownloadItem, type DownloadJob } from './manager';

const DownloadsContext = createContext<ReturnType<typeof getDownloadManager> | null>(null);

const EMPTY_JOBS: DownloadJob[] = [];

/**
 * Boots the queue once for the whole app and re-renders subscribers whenever it
 * changes. The manager itself is a singleton — the queue has to outlive route
 * changes, background tabs and app restarts.
 */
export function DownloadsProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(() => getDownloadManager(), []);

  useEffect(() => {
    void manager.init();
  }, [manager]);

  useSyncExternalStore(
    useCallback((listener) => manager.subscribe(listener), [manager]),
    () => manager.getSnapshot(),
    () => EMPTY_JOBS
  );

  return <DownloadsContext.Provider value={manager}>{children}</DownloadsContext.Provider>;
}

export function useDownloads() {
  const manager = useContext(DownloadsContext);
  // Outside the provider (isolated page, unit test) fall back to the singleton.
  return manager ?? getDownloadManager();
}

/**
 * Subscribe to queue changes and re-render. Call this in any component that
 * displays download state — it is what makes progress bars tick.
 */
export function useDownloadSubscription(): DownloadJob[] {
  const manager = useDownloads();
  return useSyncExternalStore(
    useCallback((listener) => manager.subscribe(listener), [manager]),
    () => manager.getSnapshot(),
    () => EMPTY_JOBS
  );
}

export type TitleDownloadState =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed';

/** Queue state for one specific title — used by the download buttons app-wide. */
export function useDownloadState(
  provider: string | undefined,
  sourceId: string | undefined
): { job?: DownloadJob; state: TitleDownloadState; items: DownloadItem[]; progress: number } {
  const jobs = useDownloadSubscription();

  const job = provider && sourceId
    ? jobs.find((j) => j.provider === provider && j.sourceId === sourceId)
    : undefined;

  if (!job) return { job: undefined, state: 'idle', items: [], progress: 0 };

  const items = job.items;
  const anyDownloading = items.some((i) => i.state === 'downloading');
  const anyQueued = items.some((i) => i.state === 'queued');
  const anyPaused = items.some((i) => i.state === 'paused');
  const anyFailed = items.some((i) => i.state === 'failed');
  const allDone = items.length > 0 && items.every(
    (i) => i.state === 'completed' || i.state === 'handed-off' || i.state === 'canceled'
  );

  const state: TitleDownloadState = anyDownloading
    ? 'downloading'
    : anyPaused
      ? 'paused'
      : anyQueued
        ? 'queued'
        : allDone
          ? 'completed'
          : anyFailed
            ? 'failed'
            : 'idle';

  const bytes = items.reduce((sum, i) => sum + (i.bytesWritten || 0), 0);
  const total = items.reduce((sum, i) => sum + (i.totalBytes || i.sizeBytes || 0), 0);
  const progress = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : 0;

  return { job, state, items, progress };
}

export { formatBytes, jobProgress } from './store';
