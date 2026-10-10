'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /downloads — the queue and the offline library
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  DownloadCloud,
  Film,
  HardDrive,
  Loader2,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProviderBadge, formatRuntime } from '@/components/SourceCard';
import {
  useDownloads,
  useDownloadSubscription,
  formatBytes,
} from '@/lib/downloads/use-downloads';
import { jobProgress, type DownloadItem, type DownloadJob } from '@/lib/downloads/store';
import { isNative } from '@/lib/native';

type Tab = 'queue' | 'library';

export default function DownloadsPage() {
  const manager = useDownloads();
  const jobs = useDownloadSubscription();
  const [tab, setTab] = useState<Tab>('queue');
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNative());
    void manager.init();
  }, [manager]);

  const queue = useMemo(() => jobs.filter((job) => !job.archived), [jobs]);
  const library = useMemo(() => manager.libraryItems(), [jobs, manager]);
  const stats = manager.stats();
  const location = manager.storageLocation;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline-lg text-2xl md:text-4xl text-white font-bold mb-2">
            Downloads
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            {native
              ? 'Saved straight to this device. Everything here plays with no connection at all.'
              : 'On the web, your browser saves the files to its own Downloads folder. Install the Veyra app to keep downloads inside the app and play them offline.'}
          </p>
        </div>

        {/* Status strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat
            icon={<DownloadCloud size={16} />}
            label="Active"
            value={String(stats.active + stats.queued)}
          />
          <Stat icon={<CheckCircle2 size={16} />} label="Saved" value={String(stats.completed)} />
          <Stat icon={<HardDrive size={16} />} label="On device" value={formatBytes(stats.bytes)} />
          <Stat
            icon={stats.failed ? <XCircle size={16} /> : <Film size={16} />}
            label={stats.failed ? 'Failed' : 'Storage'}
            value={stats.failed ? String(stats.failed) : location?.public ? 'Shared' : 'App only'}
            tone={stats.failed ? 'danger' : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/5">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')} count={queue.length}>
            Queue
          </TabButton>
          <TabButton active={tab === 'library'} onClick={() => setTab('library')} count={library.length}>
            Offline library
          </TabButton>
        </div>

        {tab === 'queue' ? (
          queue.length === 0 ? (
            <EmptyState
              icon={<Download size={28} />}
              title="Nothing queued"
              body="Find a film on the Internet Archive shelves and hit Download. Public-domain and Creative Commons titles can be saved; YouTube and other platforms are streaming-only."
            >
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold"
              >
                <Film size={15} /> Browse free films
              </Link>
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {queue.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => manager.archiveCompleted()}
                  className="text-on-surface-variant text-xs hover:text-white transition-colors"
                >
                  Clear finished from queue
                </button>
                <p className="text-on-surface-variant/70 text-[11px] flex items-center gap-1.5">
                  <Lock size={11} /> Only rights-cleared files are ever saved
                </p>
              </div>
            </div>
          )
        ) : library.length === 0 ? (
          <EmptyState
            icon={<HardDrive size={28} />}
            title="No offline videos yet"
            body="Completed downloads appear here and play without any connection."
          >
            <Link
              href="/search"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              Find something to save
            </Link>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {library.map((item) => (
              <LibraryRow key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Policy note */}
        <section className="mt-12 p-5 rounded-2xl bg-surface-container/60 border border-white/5">
          <h2 className="text-white text-sm font-bold mb-2">What can be downloaded, and why</h2>
          <ul className="space-y-2 text-on-surface-variant text-xs leading-relaxed">
            <li className="flex gap-2">
              <CheckCircle2 size={14} className="text-emerald-300 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Internet Archive</strong> — public-domain and
                Creative Commons films. Archive.org publishes these files for anyone to download, so
                Veyra saves them directly.
              </span>
            </li>
            <li className="flex gap-2">
              <Lock size={14} className="text-on-surface-variant shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">YouTube</strong> — plays through YouTube&apos;s own
                embed player. Downloading is not permitted by YouTube&apos;s terms, so Veyra will not
                do it and does not offer a workaround.
              </span>
            </li>
            <li className="flex gap-2">
              <Lock size={14} className="text-on-surface-variant shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Tubi, Pluto, Plex, Crackle, Kanopy</strong> — free and
                legal, but they license their libraries to their own apps only. Veyra links you there
                instead of proxying their streams.
              </span>
            </li>
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-container border border-white/5">
      <div
        className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-1.5 ${
          tone === 'danger' ? 'text-red-400' : 'text-on-surface-variant'
        }`}
      >
        {icon} {label}
      </div>
      <p className="text-white text-lg font-bold truncate">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-on-surface-variant hover:text-white'
      }`}
    >
      {children}
      {count > 0 && (
        <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-bold">
          {count}
        </span>
      )}
      {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-surface-container border border-white/5 flex items-center justify-center mx-auto mb-5 text-on-surface-variant">
        {icon}
      </div>
      <h2 className="text-white text-lg font-bold mb-2">{title}</h2>
      <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-6">{body}</p>
      {children}
    </div>
  );
}

function JobCard({ job }: { job: DownloadJob }) {
  const manager = useDownloads();
  const progress = jobProgress(job);
  const counts = job.items.reduce(
    (acc, item) => {
      acc[item.state] = (acc[item.state] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const downloading = counts.downloading || 0;
  const completed = (counts.completed || 0) + (counts['handed-off'] || 0);
  const failed = counts.failed || 0;
  const paused = counts.paused || 0;

  return (
    <div className="p-4 rounded-2xl bg-surface-container border border-white/5">
      <div className="flex items-start gap-4">
        {job.posterUrl ? (
          <img
            src={job.posterUrl}
            alt=""
            className="w-14 h-20 rounded-lg object-cover shrink-0 bg-white/5"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-20 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Film size={18} className="text-on-surface-variant" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <ProviderBadge provider={job.provider} />
            {job.kind === 'series' && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                {job.items.length} files
              </span>
            )}
          </div>
          <Link
            href={`/source?provider=${job.provider}&id=${encodeURIComponent(job.sourceId)}`}
            className="block text-white font-semibold text-sm md:text-base truncate hover:text-primary transition-colors"
          >
            {job.title}
          </Link>

          <p className="text-on-surface-variant text-xs mt-1">
            {downloading > 0 && (
              <span className="text-primary">
                {downloading} downloading · {progress.pct}% ·{' '}
                {formatBytes(progress.bytes)} / {formatBytes(progress.total)}
              </span>
            )}
            {downloading === 0 && paused > 0 && <span className="text-yellow-300">Paused</span>}
            {downloading === 0 && paused === 0 && failed > 0 && (
              <span className="text-red-400">{failed} failed</span>
            )}
            {downloading === 0 && paused === 0 && failed === 0 && completed === job.items.length && (
              <span className="text-emerald-300">Saved · {formatBytes(progress.bytes)}</span>
            )}
            {downloading === 0 && paused === 0 && failed === 0 && completed < job.items.length && (
              <span>
                {completed} of {job.items.length} saved
              </span>
            )}
            {job.license ? ` · ${job.license}` : ''}
          </p>

          {/* Bar */}
          <div className="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                failed > 0 && downloading === 0 ? 'bg-red-400' : 'bg-primary'
              }`}
              style={{ width: `${progress.pct || (completed / Math.max(1, job.items.length)) * 100}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {downloading > 0 || (counts.queued || 0) > 0 ? (
              <button
                onClick={() => manager.setJobState(job.id, 'paused')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium hover:bg-white/10"
              >
                <Pause size={12} /> Pause queue
              </button>
            ) : (
              <button
                onClick={() => manager.setJobState(job.id, 'queued')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium hover:bg-white/10"
              >
                <Play size={12} /> Resume
              </button>
            )}
            {failed > 0 && (
              <button
                onClick={() => manager.retryFailed(job.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/20"
              >
                <RotateCcw size={12} /> Retry failed
              </button>
            )}
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant text-xs font-medium hover:text-white"
              >
                Source page
              </a>
            )}
            <button
              onClick={() => manager.removeJob(job.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant text-xs font-medium hover:text-red-400 hover:border-red-500/25 ml-auto"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      </div>

      {/* Per-file detail */}
      {job.items.length > 1 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-on-surface-variant text-xs hover:text-white select-none">
            {job.items.length} files
          </summary>
          <div className="mt-2 space-y-1">
            {job.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-[11px] py-1">
                <ItemStateIcon item={item} />
                <span className="text-white/80 truncate flex-1">{item.filename}</span>
                <span className="text-on-surface-variant shrink-0">
                  {formatBytes(item.totalBytes || item.sizeBytes)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ItemStateIcon({ item }: { item: DownloadItem }) {
  switch (item.state) {
    case 'downloading':
      return <Loader2 size={12} className="animate-spin text-primary shrink-0" />;
    case 'completed':
      return <CheckCircle2 size={12} className="text-emerald-300 shrink-0" />;
    case 'handed-off':
      return <DownloadCloud size={12} className="text-sky-300 shrink-0" />;
    case 'failed':
      return <XCircle size={12} className="text-red-400 shrink-0" />;
    case 'paused':
      return <Pause size={12} className="text-yellow-300 shrink-0" />;
    case 'canceled':
      return <XCircle size={12} className="text-on-surface-variant shrink-0" />;
    default:
      return <Download size={12} className="text-on-surface-variant shrink-0" />;
  }
}

function LibraryRow({ item }: { item: DownloadItem }) {
  const manager = useDownloads();
  const playableHref = item.playableUrl
    ? `/player?local=${encodeURIComponent(item.playableUrl)}&title=${encodeURIComponent(item.title)}`
    : item.url;
  const canPlayOffline = Boolean(item.playableUrl);
  const runtime = formatRuntime(item.durationSec);

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-container border border-white/5 hover:border-white/15 transition-all">
      {item.posterUrl ? (
        <img
          src={item.posterUrl}
          alt=""
          className="w-12 h-16 rounded-lg object-cover shrink-0 bg-white/5"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-12 h-16 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Film size={16} className="text-on-surface-variant" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{item.title}</p>
        <p className="text-on-surface-variant text-xs mt-0.5 truncate">
          {item.quality ? `${item.quality}p · ` : ''}
          {formatBytes(item.totalBytes || item.sizeBytes)}
          {runtime ? ` · ${runtime}` : ''}
          {item.kind === 'subtitle' ? ' · subtitles' : ''}
          {item.state === 'handed-off' ? ' · in browser Downloads' : ''}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Link
          href={playableHref}
          target={canPlayOffline ? undefined : '_blank'}
          rel={canPlayOffline ? undefined : 'noopener noreferrer'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90"
        >
          <Play size={13} fill="currentColor" /> Play
        </Link>
        {canPlayOffline && (
          <button
            onClick={() => manager.exportItem(item)}
            aria-label="Export file"
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant hover:text-white"
          >
            <Share2 size={14} />
          </button>
        )}
        <button
          onClick={() => manager.deleteLocalFile(item)}
          aria-label="Delete file"
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
