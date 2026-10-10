// ─────────────────────────────────────────────────────────────────────────────
// Download manager — the queue that turns "Download" into files on disk
// ─────────────────────────────────────────────────────────────────────────────
// Two execution paths, one API:
//
//   native (APK)  → @capacitor/file-transfer pulls the file with the platform's
//                   own HTTP stack, reports byte-level progress, and writes
//                   into device storage. No CORS is involved at any point,
//                   which is what makes archive.org's file nodes usable.
//   web / PWA     → an <a download> hands the transfer to the browser, because
//                   archive.org's download endpoints send no CORS headers and
//                   fetch() of the bytes would be blocked.
//
// Rights are enforced here rather than in the UI: a provider whose download
// policy is `blocked` (YouTube, external platforms) can never be enqueued, even
// if someone calls this module directly from the console.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getSource,
  downloadStatus,
  type DownloadTarget,
  type Playable,
  type SourceProviderId,
} from '../sources/registry';
import {
  deleteFile as deleteNativeFile,
  isNative,
  joinPath,
  nativeDownload,
  onNativeProgress,
  providerFolder,
  resolveLocation,
  safeName,
  shareFile,
  type DownloadLocation,
} from '../native';
import {
  getAllJobs,
  jobProgress,
  putJob,
  removeJob as removeStoredJob,
  rollupState,
  type DownloadItem,
  type DownloadJob,
  type DownloadState,
} from './store';

/** Native transfers are cheap and parallel; browsers throttle them anyway. */
const CONCURRENCY_NATIVE = 2;
const CONCURRENCY_WEB = 1;
/** Gap between web hand-offs so the browser does not silently drop some. */
const WEB_HANDOFF_DELAY_MS = 1200;
const NOTIFY_THROTTLE_MS = 250;

export interface EnqueueOptions {
  /** Preferred quality label ("720", "1080"…); falls back to the best available. */
  quality?: string;
  /** Which episodes of a series to take. Defaults to the whole series. */
  episodes?: 'all' | string[];
  title?: string;
  posterUrl?: string;
  kind?: 'movie' | 'series';
}

type Listener = () => void;

let instance: DownloadManager | null = null;

export class DownloadManager {
  private jobs: DownloadJob[] = [];
  private listeners = new Set<Listener>();
  private inFlight = new Map<string, Promise<void>>();
  private initialized: Promise<void> | null = null;
  private location: DownloadLocation | null = null;
  private lastNotify = 0;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private progressUnsub: (() => void) | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Idempotent boot: restore the persisted queue and wire up progress events. */
  init(): Promise<void> {
    if (!this.initialized) {
      this.initialized = (async () => {
        if (typeof window === 'undefined') return;
        this.jobs = await getAllJobs();
        // Anything that was mid-flight when the app died is not resumable as-is,
        // so it goes back to queued and will simply be fetched again.
        this.jobs.forEach((job) => {
          job.items.forEach((item) => {
            if (item.state === 'downloading') {
              item.state = 'queued';
              item.bytesWritten = 0;
            }
          });
          job.state = rollupState(job);
        });
        this.emit(true);
        if (isNative()) {
          this.location = await resolveLocation();
          this.progressUnsub = onNativeProgress((event) => this.handleProgress(event));
        }
        await this.persistAll();
        this.pump();
      })();
    }
    return this.initialized;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): DownloadJob[] {
    return this.jobs;
  }

  getJob(id: string): DownloadJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  findJobFor(provider: SourceProviderId, sourceId: string): DownloadJob | undefined {
    return this.jobs.find((j) => j.provider === provider && j.sourceId === sourceId);
  }

  stats() {
    const items = this.jobs.flatMap((j) => j.items);
    const active = items.filter((i) => i.state === 'downloading').length;
    const queued = items.filter((i) => i.state === 'queued' || i.state === 'paused').length;
    const completed = items.filter((i) => i.state === 'completed' || i.state === 'handed-off').length;
    const failed = items.filter((i) => i.state === 'failed').length;
    const bytes = this.jobs.reduce((sum, job) => sum + jobProgress(job).bytes, 0);
    return { active, queued, completed, failed, bytes, jobs: this.jobs.length };
  }

  get storageLocation(): DownloadLocation | null {
    return this.location;
  }

  // ── Enqueueing ────────────────────────────────────────────────────────────

  /**
   * Queue a title for offline saving. Throws when the provider's rights policy
   * says no — the caller should surface that message verbatim.
   */
  async enqueuePlayable(playable: Playable, opts: EnqueueOptions = {}): Promise<DownloadJob> {
    await this.init();
    const source = getSource(playable.provider);
    const status = downloadStatus(source, playable);
    if (!status.allowed) {
      throw new Error(status.reason || 'This title cannot be downloaded.');
    }

    const existing = this.findJobFor(playable.provider, playable.id);
    if (existing && existing.state !== 'canceled' && existing.state !== 'failed') {
      // Already queued or finished — top it up rather than duplicating.
      this.addItems(existing, this.buildItems(playable, opts, existing.id));
      existing.updatedAt = Date.now();
      existing.state = rollupState(existing);
      this.emit();
      await this.persist(existing);
      this.pump();
      return existing;
    }

    const jobId = `job-${playable.provider}-${playable.id}-${Date.now()}`;
    const items = this.buildItems(playable, opts, jobId);
    if (items.length === 0) {
      throw new Error('No downloadable files were found for this title.');
    }

    const job: DownloadJob = {
      id: jobId,
      provider: playable.provider,
      sourceId: playable.id,
      title: opts.title || playable.title || playable.id,
      posterUrl: opts.posterUrl || playable.posterUrl,
      kind: opts.kind || (items.length > 1 && playable.episodes?.length ? 'series' : 'movie'),
      license: playable.license,
      licenseUrl: playable.licenseUrl,
      sourceUrl: playable.sourceUrl,
      state: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items,
    };

    this.jobs = [job, ...this.jobs];
    this.emit();
    await this.persist(job);
    this.pump();
    return job;
  }

  /**
   * Turn a resolved Playable into concrete items. A single film yields one item
   * (plus subtitles when the source provides them); a series yields one item per
   * requested episode — that is how "download the whole show" works.
   */
  private buildItems(playable: Playable, opts: EnqueueOptions, jobId: string): DownloadItem[] {
    const items: DownloadItem[] = [];
    const push = (target: DownloadTarget, extra: Partial<DownloadItem> = {}) => {
      const isSubtitle = /\.(srt|vtt|ass|ssa)$/i.test(target.filename);
      items.push({
        id: `${jobId}:${target.url}`,
        jobId,
        provider: playable.provider,
        sourceId: playable.id,
        title: opts.title || playable.title || playable.id,
        url: target.url,
        filename: target.filename,
        mimeType: target.mimeType,
        quality: target.quality,
        sizeBytes: target.sizeBytes,
        durationSec: target.durationSec,
        posterUrl: opts.posterUrl || playable.posterUrl,
        kind: isSubtitle ? 'subtitle' : (extra.kind ?? (playable.episodes?.length ? 'episode' : 'movie')),
        state: 'queued',
        bytesWritten: 0,
        totalBytes: target.sizeBytes,
        ...extra,
      });
    };

    const pickQuality = (targets: DownloadTarget[]): DownloadTarget | undefined => {
      if (targets.length === 0) return undefined;
      if (opts.quality) {
        const exact = targets.find((t) => t.quality === opts.quality);
        if (exact) return exact;
      }
      // Best-first: providers already rank their targets, but be defensive.
      return [...targets].sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0))[0];
    };

    if (playable.episodes?.length) {
      const wanted = opts.episodes;
      playable.episodes
        .filter((ep) => !Array.isArray(wanted) || wanted.includes(ep.id))
        .forEach((ep) => {
          const targets = ep.downloadTargets ?? ep.playable.downloadTargets ?? [];
          const chosen = pickQuality(targets);
          if (!chosen) return;
          push(chosen, {
            title: `${opts.title || playable.title || playable.id} — ${ep.title}`,
            kind: 'episode',
            episodeNumber: ep.number,
            seasonNumber: ep.season,
            durationSec: ep.durationSec ?? chosen.durationSec,
            posterUrl: ep.thumbnailUrl || opts.posterUrl || playable.posterUrl,
          });
          // Subtitles ride along with the episode when present.
          targets
            .filter((t) => /\.(srt|vtt|ass|ssa)$/i.test(t.filename))
            .slice(0, 2)
            .forEach((t) =>
              push(t, {
                title: `${ep.title} — subtitles`,
                kind: 'subtitle',
                episodeNumber: ep.number,
                seasonNumber: ep.season,
              })
            );
        });
      return items;
    }

    const targets = playable.downloadTargets ?? [];
    const chosen = pickQuality(targets);
    if (chosen) {
      push(chosen, { kind: opts.kind === 'series' ? 'episode' : 'movie' });
    }
    targets
      .filter((t) => /\.(srt|vtt|ass|ssa)$/i.test(t.filename))
      .slice(0, 2)
      .forEach((t) => push(t, { kind: 'subtitle' }));

    return items;
  }

  private addItems(job: DownloadJob, items: DownloadItem[]) {
    const known = new Set(job.items.map((i) => i.url));
    items.forEach((item) => {
      if (known.has(item.url)) return;
      item.jobId = job.id;
      item.id = `${job.id}:${item.url}`;
      job.items.push(item);
    });
  }

  // ── Queue control ─────────────────────────────────────────────────────────

  async setJobState(jobId: string, state: 'paused' | 'queued') {
    const job = this.getJob(jobId);
    if (!job) return;
    job.items.forEach((item) => {
      // In-flight files cannot be interrupted (the plugin has no cancel API),
      // so pausing stops the *queue*: nothing new starts until you resume.
      if (item.state === 'queued' || item.state === 'paused') item.state = state;
    });
    job.state = rollupState(job);
    job.updatedAt = Date.now();
    this.emit();
    await this.persist(job);
    this.pump();
  }

  async retryFailed(jobId: string) {
    const job = this.getJob(jobId);
    if (!job) return;
    job.items.forEach((item) => {
      if (item.state === 'failed' || item.state === 'canceled') {
        item.state = 'queued';
        item.error = undefined;
        item.bytesWritten = 0;
      }
    });
    job.state = rollupState(job);
    job.updatedAt = Date.now();
    this.emit();
    await this.persist(job);
    this.pump();
  }

  /** Remove a job and delete any files it already wrote. */
  async removeJob(jobId: string) {
    const job = this.getJob(jobId);
    if (!job) return;
    job.items.forEach((item) => {
      if (item.state === 'downloading') item.state = 'canceled';
    });
    await Promise.all(
      job.items.filter((i) => i.path).map((item) => this.deleteLocalFile(item))
    );
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    await removeStoredJob(jobId);
    this.emit(true);
    this.pump();
  }

  /**
   * Clear finished jobs out of the Queue tab.
   *
   * This never deletes media — a completed download is the whole point of the
   * feature, and the Offline library keeps serving it. Use `removeJob` (or the
   * per-item delete) when you actually want the files gone.
   */
  async archiveCompleted() {
    let changed = false;
    this.jobs.forEach((job) => {
      const done = job.items.length > 0 && job.items.every(
        (item) => item.state === 'completed' || item.state === 'handed-off' || item.state === 'canceled'
      );
      if (done && !job.archived) {
        job.archived = true;
        job.updatedAt = Date.now();
        changed = true;
      }
    });
    if (!changed) return;
    await this.persistAll();
    this.emit(true);
  }

  /** Bring an archived job back into the queue view (files are untouched). */
  async unarchive(jobId: string) {
    const job = this.getJob(jobId);
    if (!job) return;
    job.archived = false;
    job.updatedAt = Date.now();
    await this.persist(job);
    this.emit(true);
  }

  /** Everything the Offline library can play right now. */
  libraryItems(): DownloadItem[] {
    return this.jobs
      .flatMap((job) => job.items)
      .filter((item) => item.state === 'completed' || item.state === 'handed-off')
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  }

  queueJobs(): DownloadJob[] {
    return this.jobs.filter((job) => !job.archived);
  }

  async deleteLocalFile(item: DownloadItem) {
    if (!item.path || !this.location) return false;
    const ok = await deleteNativeFile(this.location, item.path);
    if (ok) {
      item.path = undefined;
      item.playableUrl = undefined;
      item.state = 'queued';
      item.bytesWritten = 0;
      const job = this.getJob(item.jobId);
      if (job) {
        job.state = rollupState(job);
        await this.persist(job);
      }
      this.emit();
    }
    return ok;
  }

  /** Export a finished file through the OS share sheet (Files, Drive, …). */
  async exportItem(item: DownloadItem): Promise<boolean> {
    if (isNative() && item.path) {
      return shareFile(item.path, item.title);
    }
    if (typeof window !== 'undefined') {
      // Web build: the browser already saved it, so just re-open the source.
      window.open(item.url, '_blank', 'noopener');
      return true;
    }
    return false;
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  private get concurrency(): number {
    return isNative() ? CONCURRENCY_NATIVE : CONCURRENCY_WEB;
  }

  /** Start as many queued items as the concurrency budget allows. */
  private pump() {
    if (typeof window === 'undefined') return;
    const queued: DownloadItem[] = [];
    this.jobs.forEach((job) => {
      if (job.state === 'paused') return;
      job.items
        .slice()
        .sort((a, b) => (a.kind === 'subtitle' ? 1 : 0) - (b.kind === 'subtitle' ? 1 : 0))
        .forEach((item) => {
          if (item.state === 'queued') queued.push(item);
        });
    });

    for (const item of queued) {
      if (this.inFlight.size >= this.concurrency) break;
      void this.run(item);
    }
  }

  private async run(item: DownloadItem) {
    const job = this.getJob(item.jobId);
    if (!job || job.state === 'paused') return;

    item.state = 'downloading';
    item.startedAt = Date.now();
    item.error = undefined;
    job.state = 'downloading';
    this.emit();
    await this.persist(job);

    const task = (async () => {
      try {
        if (isNative()) {
          await this.runNative(item, job);
        } else {
          await this.runWeb(item, job);
        }
      } catch (err) {
        item.state = item.state === 'canceled' ? 'canceled' : 'failed';
        item.error = err instanceof Error ? err.message : 'Download failed';
        if (item.state === 'failed' && item.path) {
          await this.deleteLocalFile(item).catch(() => undefined);
        }
      } finally {
        item.finishedAt = Date.now();
        job.state = rollupState(job);
        job.updatedAt = Date.now();
        this.inFlight.delete(item.id);
        this.emit();
        await this.persist(job);
        this.pump();
      }
    })();

    this.inFlight.set(item.id, task);
    await task;
  }

  private async runNative(item: DownloadItem, job: DownloadJob) {
    if (!this.location) this.location = await resolveLocation();
    const location = this.location;
    const relativePath = joinPath(
      location.basePath,
      providerFolder(item.provider),
      safeName(job.title),
      safeName(item.filename)
    );

    const result = await nativeDownload({
      url: item.url,
      location,
      relativePath,
      headers: { 'User-Agent': 'Veyra/1.0 (+https://github.com/oliver4441/veyra)' },
    });

    if (item.state === 'canceled') {
      // The transfer completed after the user cancelled — clean up.
      await deleteNativeFile(location, relativePath);
      return;
    }

    item.path = result.path;
    item.playableUrl = result.playable;
    item.state = 'completed';
    item.bytesWritten = item.totalBytes || item.sizeBytes || item.bytesWritten;
  }

  private async runWeb(item: DownloadItem, job: DownloadJob) {
    if (typeof document === 'undefined') return;
    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.download = item.filename;
    anchor.rel = 'noopener';
    anchor.target = '_blank';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // The browser owns the transfer from here; we cannot see its progress.
    item.state = 'handed-off';
    item.bytesWritten = 0;
    job.state = rollupState(job);
    await new Promise((resolve) => setTimeout(resolve, WEB_HANDOFF_DELAY_MS));
  }

  private handleProgress(event: { bytes: number; contentLength: number; url: string }) {
    let touched = false;
    this.jobs.forEach((job) => {
      job.items.forEach((item) => {
        if (item.url !== event.url || item.state !== 'downloading') return;
        item.bytesWritten = event.bytes;
        if (event.contentLength > 0) item.totalBytes = event.contentLength;
        touched = true;
      });
    });
    if (touched) this.emit();
  }

  // ── Persistence + notifications ───────────────────────────────────────────

  private async persist(job?: DownloadJob) {
    if (job) await putJob(job);
  }

  private async persistAll() {
    await Promise.all(this.jobs.map((job) => putJob(job)));
  }

  private emit(force = false) {
    const now = Date.now();
    if (!force && now - this.lastNotify < NOTIFY_THROTTLE_MS) {
      if (!this.notifyTimer) {
        this.notifyTimer = setTimeout(() => {
          this.notifyTimer = null;
          this.lastNotify = Date.now();
          this.listeners.forEach((fn) => fn());
        }, NOTIFY_THROTTLE_MS);
      }
      return;
    }
    this.lastNotify = now;
    this.listeners.forEach((fn) => fn());
  }
}

export function getDownloadManager(): DownloadManager {
  if (!instance) instance = new DownloadManager();
  return instance;
}

export type { DownloadItem, DownloadJob, DownloadState };
export { jobProgress, rollupState, formatBytes } from './store';
