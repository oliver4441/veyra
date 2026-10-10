'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /player — playback for anything that comes from an external source
// ─────────────────────────────────────────────────────────────────────────────
// Three ways in:
//   /player?provider=archive&id=xyz            → resolve + play from the source
//   /player?provider=archive&id=xyz&episode=e  → play one episode of a series
//   /player?local=<encoded>&title=…            → play a file already on device
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Film, HardDrive } from 'lucide-react';
import SourcePlayer from '@/components/SourcePlayer';
import DownloadButton from '@/components/DownloadButton';
import { ProviderBadge } from '@/components/SourceCard';
import { resolvePlayable, getSource } from '@/lib/sources/registry';
import { getProgressFor, saveProgress } from '@/lib/mylist';
import type { Playable, SourceProviderId } from '@/lib/sources/types';

const VALID_PROVIDERS: SourceProviderId[] = ['archive', 'youtube', 'external', 'veyra'];

function PlayerPage() {
  const params = useSearchParams();
  const router = useRouter();

  const providerParam = (params.get('provider') || '') as SourceProviderId;
  const provider = VALID_PROVIDERS.includes(providerParam) ? providerParam : null;
  const id = params.get('id') || '';
  const episodeId = params.get('episode') || undefined;
  const localUrl = params.get('local') || undefined;
  const titleParam = params.get('title') || undefined;

  const [playable, setPlayable] = useState<Playable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<string | undefined>(episodeId);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const source = provider ? getSource(provider) : undefined;

  // Local (already downloaded) playback needs no resolution at all.
  const localPlayable = useMemo<Playable | null>(() => {
    if (!localUrl) return null;
    return {
      provider: 'archive',
      id: localUrl,
      kind: 'video',
      url: localUrl,
      title: titleParam || 'Downloaded video',
    };
  }, [localUrl, titleParam]);

  useEffect(() => {
    if (localPlayable) {
      setPlayable(localPlayable);
      setLoading(false);
      return;
    }
    if (!provider || !id) {
      setError('Nothing to play — this link is missing a provider or an id.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resolved = await resolvePlayable(provider, id, { episodeId: activeEpisode });
        if (cancelled) return;
        if (!resolved) {
          setError('This title is no longer available from the provider.');
        } else {
          setPlayable(resolved);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Playback failed to start.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider, id, activeEpisode, localPlayable]);

  // ── Resume point ──────────────────────────────────────────────────────────
  const [initialPosition, setInitialPosition] = useState(0);
  useEffect(() => {
    if (!provider || !id) return;
    const entry = getProgressFor(provider, id);
    if (entry && !entry.completed && entry.position > 5) {
      setInitialPosition(entry.position);
    } else {
      setInitialPosition(0);
    }
  }, [provider, id, activeEpisode]);

  const handleProgress = useCallback(
    (position: number, duration: number) => {
      if (!provider || !id || !duration) return;
      saveProgress({
        provider,
        id,
        episodeId: activeEpisode,
        title: playable?.title || id,
        posterUrl: playable?.posterUrl,
        position: Math.floor(position),
        duration: Math.floor(duration),
        completed: position / duration > 0.95,
      });
    },
    [provider, id, activeEpisode, playable]
  );

  // Persist periodically (and once on the way out) so closing the app mid-film
  // still resumes in the right place.
  useEffect(() => {
    if (localPlayable) return;
    const last = { position: 0, duration: 0 };
    progressTimer.current = setInterval(() => {
      const video = document.querySelector('video');
      if (!video || !video.currentTime) return;
      last.position = video.currentTime;
      last.duration = video.duration || 0;
      handleProgress(last.position, last.duration);
    }, 15000);
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (last.position > 0) handleProgress(last.position, last.duration);
    };
  }, [handleProgress, localPlayable]);

  // ── Episode navigation ────────────────────────────────────────────────────
  const episodes = playable?.episodes ?? [];
  const currentIndex = episodes.findIndex((ep) => ep.id === activeEpisode);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < episodes.length - 1;

  const goEpisode = (dir: -1 | 1) => {
    const next = episodes[currentIndex + dir];
    if (!next) return;
    setActiveEpisode(next.id);
    const url = `/player?provider=${provider}&id=${encodeURIComponent(id)}&episode=${encodeURIComponent(next.id)}`;
    router.replace(url, { scroll: false });
  };

  const handleBack = useCallback(() => {
    if (localPlayable) {
      router.push('/downloads');
      return;
    }
    if (provider && id) {
      router.push(`/source?provider=${provider}&id=${encodeURIComponent(id)}`);
      return;
    }
    router.back();
  }, [localPlayable, provider, id, router]);

  const detailHref =
    provider && id ? `/source?provider=${provider}&id=${encodeURIComponent(id)}` : '/downloads';

  return (
    <div className="min-h-screen bg-black">
      {/* Player fills the viewport */}
      <div className="w-full h-[60vh] md:h-[85vh] relative">
        <SourcePlayer
          playable={playable}
          loading={loading}
          error={error}
          title={playable?.title || titleParam}
          subtitle={
            localPlayable
              ? 'Playing from this device'
              : episodes.length > 1 && currentIndex >= 0
                ? `Episode ${episodes[currentIndex].number} of ${episodes.length}`
                : source?.name
          }
          onBack={handleBack}
          onProgress={handleProgress}
          initialPosition={initialPosition}
          actions={
            <>
              {provider && !localPlayable && (
                <Link
                  href={detailHref}
                  className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white text-xs font-medium"
                >
                  <Film size={13} /> Details
                </Link>
              )}
              {provider && id && !localPlayable && (
                <div className="hidden md:block">
                  <DownloadButton
                    provider={provider}
                    sourceId={id}
                    title={playable?.title || id}
                    posterUrl={playable?.posterUrl}
                    playable={playable}
                    variant="icon"
                    compact
                  />
                </div>
              )}
            </>
          }
        />
      </div>

      {/* Below the player */}
      <div className="px-5 md:px-16 max-w-[1100px] mx-auto py-6 md:py-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {provider && !localPlayable && <ProviderBadge provider={provider} />}
              {localPlayable && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/15 text-emerald-300 border-emerald-400/25 inline-flex items-center gap-1">
                  <HardDrive size={10} /> Offline
                </span>
              )}
            </div>
            <h1 className="text-white text-lg md:text-2xl font-bold truncate">
              {playable?.title || titleParam || 'Now playing'}
            </h1>
            {playable?.license && (
              <p className="text-on-surface-variant text-xs mt-1">{playable.license}</p>
            )}
          </div>

          {episodes.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => goEpisode(-1)}
                disabled={!hasPrev}
                aria-label="Previous episode"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/10"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                onClick={() => goEpisode(1)}
                disabled={!hasNext}
                aria-label="Next episode"
                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-30 hover:bg-white/10"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile actions */}
        {provider && id && !localPlayable && (
          <div className="md:hidden flex items-center gap-2 mb-6">
            <DownloadButton
              provider={provider}
              sourceId={id}
              title={playable?.title || id}
              posterUrl={playable?.posterUrl}
              playable={playable}
              compact
            />
            <Link
              href={detailHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium"
            >
              <Film size={15} /> Details
            </Link>
          </div>
        )}

        {/* Episode list */}
        {episodes.length > 0 && (
          <section>
            <h2 className="text-white text-sm font-bold uppercase tracking-wider mb-3">
              Episodes
            </h2>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {episodes.map((ep) => {
                const active = ep.id === activeEpisode;
                return (
                  <button
                    key={ep.id}
                    onClick={() => {
                      setActiveEpisode(ep.id);
                      router.replace(
                        `/player?provider=${provider}&id=${encodeURIComponent(id)}&episode=${encodeURIComponent(ep.id)}`,
                        { scroll: false }
                      );
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                      active
                        ? 'bg-primary/15 border border-primary/25'
                        : 'bg-surface-container border border-transparent hover:border-white/10'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold w-6 shrink-0 ${
                        active ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {ep.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm truncate ${active ? 'text-white font-medium' : 'text-white/85'}`}>
                        {ep.title}
                      </span>
                      {ep.durationSec && (
                        <span className="block text-on-surface-variant text-[11px] mt-0.5">
                          {Math.round(ep.durationSec / 60)} min
                        </span>
                      )}
                    </span>
                    {active && <Download size={13} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <Link
          href={detailHref}
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white text-sm mt-8"
        >
          <ArrowLeft size={15} /> {localPlayable ? 'Back to downloads' : 'Back to details'}
        </Link>
      </div>
    </div>
  );
}

export default function PlayerRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <PlayerPage />
    </Suspense>
  );
}
