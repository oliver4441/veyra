'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DownloadButton — the single control that saves a title to local storage
// ─────────────────────────────────────────────────────────────────────────────
// It answers three questions for the user, in this order:
//   1. May this be downloaded at all? (provider policy + verified rights)
//   2. What exactly will be saved? (one film, or every episode of a series)
//   3. How far along is it? (live progress from the queue)
//
// When the answer to (1) is no, the button says why instead of disappearing —
// a YouTube title explains that streaming-only is YouTube's rule, not ours.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  Download,
  DownloadCloud,
  Loader2,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { downloadStatus, getSource, resolvePlayable } from '@/lib/sources/registry';
import { useDownloadState, useDownloads, formatBytes } from '@/lib/downloads/use-downloads';
import { isNative } from '@/lib/native';
import type { Playable, SourceProviderId } from '@/lib/sources/types';

interface DownloadButtonProps {
  provider: SourceProviderId;
  sourceId: string;
  title: string;
  posterUrl?: string;
  /** Already-resolved playable. When omitted the button resolves on demand. */
  playable?: Playable | null;
  variant?: 'primary' | 'ghost' | 'icon';
  className?: string;
  /** Hide the per-episode picker (e.g. on a compact card). */
  compact?: boolean;
}

export default function DownloadButton({
  provider,
  sourceId,
  title,
  posterUrl,
  playable,
  variant = 'primary',
  className = '',
  compact = false,
}: DownloadButtonProps) {
  const router = useRouter();
  const manager = useDownloads();
  const { state, job, progress, items } = useDownloadState(provider, sourceId);

  const [resolved, setResolved] = useState<Playable | null | undefined>(playable ?? undefined);
  const [resolving, setResolving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const source = getSource(provider);
  const status = downloadStatus(source, resolved ?? null);
  const episodes = resolved?.episodes ?? [];

  // Close the episode menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  // Resolve lazily: a title page should not pay for a metadata call until the
  // user actually wants to save something.
  const ensureResolved = useCallback(async (): Promise<Playable | null> => {
    if (resolved) return resolved;
    setResolving(true);
    try {
      const found = await resolvePlayable(provider, sourceId);
      setResolved(found);
      return found;
    } catch {
      setResolved(null);
      return null;
    } finally {
      setResolving(false);
    }
  }, [resolved, provider, sourceId]);

  const enqueue = useCallback(
    async (episodeIds?: 'all' | string[]) => {
      setMenuOpen(false);
      const target = await ensureResolved();
      if (!target) {
        setMessage('Could not find downloadable files for this title.');
        return;
      }
      const check = downloadStatus(getSource(target.provider), target);
      if (!check.allowed) {
        setMessage(check.reason || 'Downloads are not permitted for this source.');
        return;
      }
      try {
        await manager.enqueuePlayable(target, {
          title,
          posterUrl,
          episodes: episodeIds,
          kind: episodes.length > 1 ? 'series' : 'movie',
        });
        setMessage(
          episodeIds === 'all' && episodes.length > 1
            ? `Queued all ${episodes.length} episodes.`
            : isNative()
              ? 'Download started — it keeps going in the background.'
              : 'Your browser is saving the file to its Downloads folder.'
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Download failed to start.');
      }
    },
    [ensureResolved, manager, title, posterUrl, episodes.length]
  );

  // ── Active job controls ───────────────────────────────────────────────────
  if (job && state !== 'idle' && state !== 'completed') {
    const totalBytes = items.reduce((sum, i) => sum + (i.totalBytes || i.sizeBytes || 0), 0);
    return (
      <div className={`relative ${className}`}>
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
            state === 'failed'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-white/10 bg-surface-container'
          }`}
        >
          {state === 'downloading' && <Loader2 size={16} className="animate-spin text-primary" />}
          {state === 'queued' && <DownloadCloud size={16} className="text-primary" />}
          {state === 'paused' && <Pause size={16} className="text-yellow-300" />}
          {state === 'failed' && <RotateCcw size={16} className="text-red-400" />}

          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">
              {state === 'failed'
                ? `${items.filter((i) => i.state === 'failed').length} file(s) failed`
                : state === 'paused'
                  ? 'Paused'
                  : `${progress}% · ${items.filter((i) => i.state === 'downloading' || i.state === 'queued').length} left`}
            </p>
            {totalBytes > 0 && (
              <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    state === 'failed' ? 'bg-red-400' : 'bg-primary'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {state === 'failed' ? (
            <button
              onClick={() => manager.retryFailed(job.id)}
              aria-label="Retry download"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10"
            >
              <RotateCcw size={15} />
            </button>
          ) : state === 'paused' ? (
            <button
              onClick={() => manager.setJobState(job.id, 'queued')}
              aria-label="Resume download"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10"
            >
              <Play size={15} />
            </button>
          ) : (
            <button
              onClick={() => manager.setJobState(job.id, 'paused')}
              aria-label="Pause queue"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10"
            >
              <Pause size={15} />
            </button>
          )}

          <button
            onClick={() => router.push('/downloads')}
            aria-label="Open downloads"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10"
          >
            <ChevronDown size={15} className="-rotate-90" />
          </button>
        </div>
        {message && <Toast message={message} />}
      </div>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (job && state === 'completed') {
    return (
      <div className={`relative flex items-center gap-2 ${className}`}>
        <button
          onClick={() => router.push('/downloads')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            variant === 'primary'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 hover:bg-emerald-500/25'
              : 'bg-white/5 text-emerald-300 border border-white/10 hover:bg-white/10'
          }`}
        >
          <Check size={16} />
          {compact ? 'Saved' : 'Downloaded — open library'}
        </button>
        <button
          onClick={() => manager.removeJob(job.id)}
          aria-label="Delete download and files"
          className="p-2.5 rounded-xl text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 border border-white/10"
        >
          <Trash2 size={15} />
        </button>
        {message && <Toast message={message} />}
      </div>
    );
  }

  // ── Blocked by policy ─────────────────────────────────────────────────────
  if (source && source.capabilities.download === 'blocked') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setMessage(status.reason || 'Downloads are not permitted for this source.')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${
            variant === 'primary'
              ? 'bg-white/5 text-on-surface-variant border-white/10 hover:text-white hover:bg-white/10'
              : 'bg-transparent text-on-surface-variant/70 border-white/5 hover:text-white'
          }`}
          title={status.reason}
        >
          <Lock size={15} />
          {compact ? 'Stream only' : 'Streaming only'}
        </button>
        {message && <Toast message={message} />}
      </div>
    );
  }

  // ── Ready to queue ────────────────────────────────────────────────────────
  const baseClass =
    variant === 'primary'
      ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-lg shadow-primary/20'
      : variant === 'ghost'
        ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        : 'bg-white/5 text-on-surface-variant hover:text-white border border-white/10';

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => (episodes.length > 1 && !compact ? setMenuOpen((v) => !v) : enqueue())}
          disabled={resolving}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-60 ${
            variant === 'icon' ? 'px-2.5 py-2.5' : baseClass
          }`}
        >
          {resolving ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {variant === 'icon' ? '' : compact ? 'Download' : episodes.length > 1 ? 'Download' : 'Download'}
        </button>

        {episodes.length > 1 && !compact && (
          <button
            onClick={() => enqueue('all')}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
          >
            <DownloadCloud size={15} />
            All {episodes.length}
          </button>
        )}
      </div>

      {menuOpen && episodes.length > 1 && (
        <div className="absolute z-40 mt-2 w-72 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-surface-container/95 backdrop-blur-xl shadow-2xl shadow-black/60">
          <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-surface-container/95 backdrop-blur-xl">
            <p className="text-white text-xs font-bold uppercase tracking-wider">Choose episodes</p>
            <button
              onClick={() => enqueue('all')}
              className="text-primary text-xs font-bold hover:underline"
            >
              All {episodes.length}
            </button>
          </div>
          {episodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => enqueue([ep.id])}
              className="w-full text-left px-3 py-2.5 hover:bg-white/5 flex items-center gap-3 border-b border-white/5 last:border-0"
            >
              <Download size={14} className="text-on-surface-variant shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-white text-xs font-medium truncate">
                  {ep.number ? `E${ep.number} · ` : ''}
                  {ep.title}
                </span>
                <span className="block text-on-surface-variant text-[11px] mt-0.5">
                  {ep.downloadTargets?.[0]?.sizeBytes
                    ? formatBytes(ep.downloadTargets[0].sizeBytes)
                    : 'Size unknown'}
                  {ep.durationSec ? ` · ${Math.round(ep.durationSec / 60)} min` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {message && <Toast message={message} />}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="absolute left-0 right-0 -bottom-2 translate-y-full z-50 mt-2 pointer-events-none">
      <p className="inline-block px-3 py-2 rounded-lg bg-surface-container-high/95 backdrop-blur-xl border border-white/10 text-white text-xs shadow-xl shadow-black/40 max-w-sm">
        {message}
      </p>
    </div>
  );
}
