'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SourcePlayer — one player surface for every kind of source
// ─────────────────────────────────────────────────────────────────────────────
// Veyra now plays three fundamentally different things:
//   video/hls  → our own R2 files and archive.org's MP4 derivatives
//   iframe     → the official YouTube and archive.org embed players
//   external   → Tubi/Pluto/Plex…, which we hand off to instead of embedding
// This component picks the right surface so pages never have to.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Info, Loader2, ShieldCheck } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import type { Playable } from '@/lib/sources/types';
import { providerLabel } from '@/lib/sources/registry';

interface SourcePlayerProps {
  playable: Playable | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onProgress?: (position: number, duration: number) => void;
  initialPosition?: number;
  /** Extra controls rendered on the right of the top bar. */
  actions?: React.ReactNode;
}

export default function SourcePlayer({
  playable,
  loading = false,
  error = null,
  title,
  subtitle,
  onBack,
  onProgress,
  initialPosition = 0,
  actions,
}: SourcePlayerProps) {
  if (loading) {
    return (
      <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 size={34} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm">Preparing playback…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-black px-6">
        <div className="text-center max-w-md">
          <span className="text-4xl block mb-3">⚠️</span>
          <h2 className="text-white font-bold text-lg mb-2">Playback problem</h2>
          <p className="text-on-surface-variant text-sm mb-5">{error}</p>
          {playable?.sourceUrl && (
            <a
              href={playable.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline"
            >
              Open on {providerLabel(playable.provider)} <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!playable) return null;

  if (playable.kind === 'external') {
    return <ExternalHandoff playable={playable} title={title} subtitle={subtitle} onBack={onBack} />;
  }

  if (playable.kind === 'iframe') {
    return (
      <EmbedPlayer
        playable={playable}
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        actions={actions}
      />
    );
  }

  return (
    <VideoPlayer
      src={playable.url}
      title={title || playable.title}
      posterUrl={playable.posterUrl}
      onProgress={onProgress}
      initialPosition={initialPosition}
      onBack={onBack}
    />
  );
}

// ── Iframe surface ──────────────────────────────────────────────────────────

function EmbedPlayer({
  playable,
  title,
  subtitle,
  onBack,
  actions,
}: {
  playable: Playable;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset state when the video changes (episode switching).
  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [playable.url]);

  // If the provider refuses embedding (some uploads opt out) the frame stays
  // blank; offer the escape hatch after a timeout rather than a dead screen.
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 12000);
    return () => clearTimeout(timer);
  }, [ready, failed, playable.url]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/85 to-transparent">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white border border-white/10"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold truncate">{title || playable.title}</p>
          {subtitle && (
            <p className="text-on-surface-variant text-xs truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>

      <div className="relative w-full h-full aspect-video">
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={30} className="animate-spin text-primary" />
          </div>
        )}

        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="text-center max-w-sm">
              <Info size={28} className="text-primary mx-auto mb-3" />
              <p className="text-white text-sm font-medium mb-1">This video cannot be embedded</p>
              <p className="text-on-surface-variant text-xs mb-4">
                The uploader has disabled embedding, so {providerLabel(playable.provider)} will only
                play it on their own site.
              </p>
              {playable.sourceUrl && (
                <a
                  href={playable.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold"
                >
                  Watch on {providerLabel(playable.provider)} <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            src={playable.url}
            title={title || playable.title || 'Video player'}
            className="absolute inset-0 w-full h-full"
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
          />
        )}
      </div>

      {playable.license && (
        <p className="absolute bottom-2 right-3 z-20 flex items-center gap-1 text-[10px] text-white/50">
          <ShieldCheck size={11} /> {playable.license}
        </p>
      )}
    </div>
  );
}

// ── External hand-off ───────────────────────────────────────────────────────

function ExternalHandoff({
  playable,
  title,
  subtitle,
  onBack,
}: {
  playable: Playable;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const providers = (playable.meta?.providers as Array<{ name: string; type?: string; posterUrl?: string }> | undefined) ?? [];
  const free = (playable.meta?.free as Array<{ name: string }> | undefined) ?? [];

  return (
    <div className="relative w-full min-h-[60vh] bg-gradient-to-b from-surface-container to-background flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/80 hover:text-white border border-white/10"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{title || playable.title}</p>
          {subtitle && <p className="text-on-surface-variant text-xs truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <ExternalLink size={26} className="text-primary" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Stream on the platform itself</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            {free.length > 0
              ? `This title is free on ${free.map((p) => p.name).join(', ')}. Veyra does not re-host or proxy other platforms' content — we send you to their official app or site.`
              : 'Veyra does not re-host or proxy other platforms\' content. We point you at the services that legally stream this title in your region.'}
          </p>

          {providers.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {providers.slice(0, 8).map((p) => (
                <span
                  key={p.name}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium"
                >
                  {p.name}
                  {p.type === 'free' || p.type === 'ads' ? (
                    <span className="text-emerald-300 ml-1.5 text-[10px] uppercase font-bold">
                      {p.type === 'free' ? 'Free' : 'Free with ads'}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          )}

          <a
            href={playable.externalUrl || playable.sourceUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            {playable.externalProvider ? `Open ${playable.externalProvider}` : 'See where to watch'}
            <ExternalLink size={16} />
          </a>

          <p className="text-on-surface-variant/70 text-[11px] mt-6">
            Availability varies by region. Data from TMDB (JustWatch).
          </p>
        </div>
      </div>
    </div>
  );
}
