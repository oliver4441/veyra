'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /source — detail page for a title that lives on an external provider
// ─────────────────────────────────────────────────────────────────────────────
// Reached from any shelf or search result via /source?provider=archive&id=xyz.
// Query params rather than path params on purpose: a Capacitor build is a
// static export, and static exports cannot pre-render arbitrary path segments.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  Film,
  Play,
  ShieldCheck,
  User,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SourceCard, { ProviderBadge, formatRuntime } from '@/components/SourceCard';
import SourceRow from '@/components/SourceRow';
import DownloadButton from '@/components/DownloadButton';
import { getSource, resolvePlayable, searchProvider } from '@/lib/sources/registry';
import { addToMyList, isInMyList, removeFromMyList, subscribeGuestStore } from '@/lib/mylist';
import { formatBytes } from '@/lib/downloads/use-downloads';
import type { Playable, SourceItem, SourceProviderId } from '@/lib/sources/types';

const VALID_PROVIDERS: SourceProviderId[] = ['archive', 'youtube', 'external', 'veyra'];

function SourceDetail() {
  const params = useSearchParams();
  const providerParam = (params.get('provider') || 'archive') as SourceProviderId;
  const id = params.get('id') || '';
  const episodeParam = params.get('episode') || undefined;

  const provider = VALID_PROVIDERS.includes(providerParam) ? providerParam : 'archive';

  const [item, setItem] = useState<SourceItem | null>(null);
  const [playable, setPlayable] = useState<Playable | null>(null);
  const [related, setRelated] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const source = getSource(provider);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItem(null);
    setPlayable(null);

    (async () => {
      if (!id) {
        if (!cancelled) {
          setError('No title specified.');
          setLoading(false);
        }
        return;
      }
      try {
        const [described, resolved] = await Promise.all([
          source?.describe ? source.describe(id) : Promise.resolve(null),
          resolvePlayable(provider, id, { episodeId: episodeParam }),
        ]);
        if (cancelled) return;
        setItem(described);
        setPlayable(resolved);
        if (!described && !resolved) setError('This title could not be loaded from the provider.');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load this title.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider, id, episodeParam, source]);

  // Keep the bookmark in sync with the on-device list (other tabs included).
  useEffect(() => {
    if (!id) return;
    const sync = () => setSaved(isInMyList(provider, id));
    sync();
    return subscribeGuestStore(sync);
  }, [provider, id]);

  // "More like this" — same provider, keywords from the title.
  useEffect(() => {
    const title = item?.title;
    if (!title || !source?.capabilities.search) return;
    let cancelled = false;
    (async () => {
      const keywords = title
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4)
        .join(' ');
      if (!keywords) return;
      const res = await searchProvider(provider, keywords, { limit: 12 });
      if (cancelled || !res) return;
      setRelated(res.items.filter((r) => r.id !== id).slice(0, 10));
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.title, provider, id, source]);

  const title = item?.title || playable?.title || id;
  const poster = item?.posterUrl || playable?.posterUrl;
  const description = item?.description;
  const episodes = playable?.episodes ?? [];
  const downloadTargets = useMemo(() => {
    const targets = playable?.downloadTargets ?? [];
    return targets.filter((t) => !/\.(srt|vtt|ass|ssa)$/i.test(t.filename));
  }, [playable]);

  const toggleSaved = useCallback(() => {
    if (!id) return;
    if (isInMyList(provider, id)) {
      removeFromMyList(provider, id);
      setSaved(false);
    } else {
      addToMyList({
        provider,
        id,
        title,
        posterUrl: poster,
        year: item?.year,
        kind: item?.kind || (episodes.length > 1 ? 'series' : 'movie'),
        license: item?.license || playable?.license,
        sourceUrl: item?.sourceUrl || playable?.sourceUrl,
      });
      setSaved(true);
    }
  }, [id, provider, title, poster, item, playable, episodes.length]);

  const watchHref = `/player?provider=${provider}&id=${encodeURIComponent(id)}`;

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-24 px-5 md:px-16 max-w-[1200px] mx-auto">
          <div className="h-[46vh] rounded-2xl bg-surface-container animate-pulse" />
          <div className="h-6 w-1/2 bg-surface-container rounded mt-6 animate-pulse" />
          <div className="h-4 w-1/3 bg-surface-container rounded mt-3 animate-pulse" />
        </main>
      </div>
    );
  }

  if (error || (!item && !playable)) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-32 pb-20 px-5 text-center">
          <span className="text-5xl block mb-4">🎞️</span>
          <h1 className="text-white text-xl font-bold mb-2">Title unavailable</h1>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-6">
            {error || 'The provider did not return anything for this link.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold"
          >
            <ArrowLeft size={15} /> Back home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <div className="relative pt-16">
        <div className="absolute inset-0 -z-10">
          {poster ? (
            <img
              src={poster}
              alt=""
              className="w-full h-full object-cover opacity-25 blur-sm scale-105"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-transparent" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/50" />
        </div>

        <div className="px-5 md:px-16 max-w-[1200px] mx-auto pt-8 pb-10 flex flex-col md:flex-row gap-6 md:gap-10">
          {/* Poster */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="w-40 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-surface-container border border-white/10 shadow-2xl shadow-black/60">
              {poster ? (
                <img
                  src={poster}
                  alt={title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={40} className="text-on-surface-variant" />
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3 flex-wrap">
              <ProviderBadge provider={provider} />
              {item?.license && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-300 border-emerald-400/20">
                  {item.license}
                </span>
              )}
              {episodes.length > 1 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-white/5 text-on-surface-variant border-white/10">
                  {episodes.length} episodes
                </span>
              )}
            </div>

            <h1 className="font-headline-lg text-3xl md:text-5xl text-white font-bold leading-tight mb-3">
              {title}
            </h1>

            <div className="flex items-center justify-center md:justify-start gap-3 text-on-surface-variant text-sm mb-6 flex-wrap">
              {item?.year && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} /> {item.year}
                </span>
              )}
              {formatRuntime(item?.durationSec) && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} /> {formatRuntime(item?.durationSec)}
                </span>
              )}
              {item?.creator && (
                <span className="inline-flex items-center gap-1.5">
                  <User size={13} /> {item.creator}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap mb-6">
              <Link
                href={watchHref}
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
              >
                <Play size={17} fill="currentColor" /> Play now
              </Link>

              <DownloadButton
                provider={provider}
                sourceId={id}
                title={title}
                posterUrl={poster}
                playable={playable}
                variant="ghost"
              />

              <button
                onClick={toggleSaved}
                aria-label={saved ? 'Remove from My List' : 'Add to My List'}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                  saved
                    ? 'bg-primary/15 text-primary border-primary/25'
                    : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                }`}
              >
                {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                {saved ? 'In My List' : 'My List'}
              </button>

              {(item?.sourceUrl || playable?.sourceUrl) && (
                <a
                  href={item?.sourceUrl || playable?.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-white/5 text-on-surface-variant border border-white/10 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ExternalLink size={15} /> {source?.shortName}
                </a>
              )}
            </div>

            {description && (
              <p className="text-on-surface-variant text-sm md:text-base leading-relaxed max-w-2xl mx-auto md:mx-0 whitespace-pre-line">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="px-5 md:px-16 max-w-[1200px] mx-auto pb-24 space-y-10">
        {/* Episodes */}
        {episodes.length > 0 && (
          <section>
            <h2 className="font-headline-md text-xl text-white font-semibold mb-4">Episodes</h2>
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-container border border-white/5 hover:border-white/15 transition-all group"
                >
                  <Link
                    href={`/player?provider=${provider}&id=${encodeURIComponent(id)}&episode=${encodeURIComponent(ep.id)}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:border-primary/30 transition-all">
                      <Play size={14} fill="currentColor" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-white text-sm font-medium truncate">
                        {ep.number ? `${ep.number}. ` : ''}
                        {ep.title}
                      </span>
                      <span className="block text-on-surface-variant text-xs mt-0.5">
                        {ep.durationSec ? `${Math.round(ep.durationSec / 60)} min` : 'Duration unknown'}
                        {ep.downloadTargets?.[0]?.sizeBytes
                          ? ` · ${formatBytes(ep.downloadTargets[0].sizeBytes)}`
                          : ''}
                      </span>
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* File options */}
        {downloadTargets.length > 1 && (
          <section>
            <h2 className="font-headline-md text-xl text-white font-semibold mb-4">
              Available files
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {downloadTargets.map((target) => (
                <a
                  key={target.url}
                  href={target.url}
                  download={target.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-surface-container border border-white/5 hover:border-primary/30 transition-all"
                >
                  <Download size={16} className="text-primary shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-white text-sm font-medium truncate">
                      {target.quality ? `${target.quality}p` : target.filename}
                    </span>
                    <span className="block text-on-surface-variant text-xs mt-0.5 truncate">
                      {formatBytes(target.sizeBytes)} · {target.filename}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Rights + attribution */}
        <section className="p-5 rounded-2xl bg-surface-container/60 border border-white/5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-white text-sm font-bold mb-1.5">Rights &amp; attribution</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                {item?.license || playable?.license || 'Licence not stated'}
                {item?.licenseUrl ? (
                  <>
                    {' · '}
                    <a
                      href={item.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      licence terms
                    </a>
                  </>
                ) : null}
                . {source?.attribution || ''} Veyra does not host this file; it streams from (and,
                where the licence allows, saves a copy from) the provider directly.
              </p>
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <SourceRow title={`More from ${source?.shortName || 'this source'}`} items={related} size="sm" />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SourcePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <SourceDetail />
    </Suspense>
  );
}
