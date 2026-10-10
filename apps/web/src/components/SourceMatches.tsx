'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SourceMatches — "where can I actually watch this?"
// ─────────────────────────────────────────────────────────────────────────────
// Shown on a catalogue title's page. It does two independent things:
//
//   1. Searches the Internet Archive for the same title. Public-domain films are
//      frequently on archive.org even when Veyra does not host a copy, so this
//      turns a metadata-only entry into something playable and downloadable.
//   2. Asks TMDB which services legally stream the title in the visitor's
//      region, and links out to them (Tubi, Pluto, Plex, Kanopy…).
//
// Both halves fail silently. A title with no free source simply shows nothing
// rather than an error, because that is the normal case for new releases.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Info, Search } from 'lucide-react';
import SourceCard from './SourceCard';
import { fetchWatchProviders, defaultRegion, type WatchProviderInfo } from '@/lib/sources/external';
import { archiveSource } from '@/lib/sources/archive';
import type { SourceItem } from '@/lib/sources/types';

interface SourceMatchesProps {
  title: string;
  year?: number;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  /** Hide the whole section (used on compact layouts). */
  compact?: boolean;
}

/** Loose similarity check so "Dracula (1931)" does not match "Dracula 2000". */
function looksLikeMatch(item: SourceItem, title: string, year?: number): boolean {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(item.title);
  const b = norm(title);
  const titleMatches = a === b || a.includes(b) || b.includes(a);
  if (!titleMatches) return false;
  if (!year || !item.year) return true;
  // Allow a year of slack: release vs. archive date often differ by one.
  return Math.abs(item.year - year) <= 1;
}

export default function SourceMatches({
  title,
  year,
  tmdbId,
  mediaType = 'movie',
  compact = false,
}: SourceMatchesProps) {
  const [matches, setMatches] = useState<SourceItem[]>([]);
  const [providers, setProviders] = useState<WatchProviderInfo | null>(null);
  const [searching, setSearching] = useState(true);
  const [region] = useState(() => defaultRegion());

  useEffect(() => {
    let cancelled = false;
    setSearching(true);

    (async () => {
      const [searchResult, providerResult] = await Promise.all([
        archiveSource
          .search(title, { limit: 12, featureFilmsOnly: false })
          .catch(() => ({ provider: 'archive' as const, query: title, items: [] as SourceItem[], page: 1 })),
        tmdbId ? fetchWatchProviders(tmdbId, mediaType, region) : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const exact = searchResult.items.filter((item) => looksLikeMatch(item, title, year));
      // Fall back to looser matches when nothing lines up exactly.
      setMatches(exact.length > 0 ? exact.slice(0, 8) : searchResult.items.slice(0, 4));
      setProviders(providerResult);
      setSearching(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [title, year, tmdbId, mediaType, region]);

  const freeProviders = useMemo(
    () => (providers?.free ?? []).slice(0, 6),
    [providers]
  );
  const otherProviders = useMemo(
    () => (providers?.subscription ?? []).slice(0, 6),
    [providers]
  );

  if (searching) {
    return (
      <section className="mb-8">
        <h2 className="font-headline-md text-xl text-white mb-4">Watch free</h2>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[150px] shrink-0">
              <div className="h-[225px] rounded-xl bg-surface-container animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (matches.length === 0 && freeProviders.length === 0 && otherProviders.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container/60 border border-white/5">
          <Info size={16} className="text-on-surface-variant shrink-0 mt-0.5" />
          <p className="text-on-surface-variant text-xs leading-relaxed">
            No free, rights-cleared copy of this title turned up on the Internet Archive, and no
            ad-supported service is streaming it in {region}. It may still be available to rent or
            stream on a paid service.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <h2 className="font-headline-md text-xl text-white mb-1">Watch free</h2>
      <p className="text-on-surface-variant text-xs mb-4">
        Rights-cleared copies and the services legally streaming this title in {region}.
      </p>

      {/* Other platforms (link-out) */}
      {(freeProviders.length > 0 || otherProviders.length > 0) && providers && (
        <div className="mb-6">
          {freeProviders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mr-1">
                Free
              </span>
              {freeProviders.map((p) => (
                <ProviderChip key={p.providerId} name={p.name} logoUrl={p.logoUrl} href={providers.link} />
              ))}
            </div>
          )}
          {otherProviders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant mr-1">
                Subscription
              </span>
              {otherProviders.map((p) => (
                <ProviderChip
                  key={p.providerId}
                  name={p.name}
                  logoUrl={p.logoUrl}
                  href={providers.link}
                  muted
                />
              ))}
            </div>
          )}
          <p className="text-on-surface-variant/70 text-[11px] mt-3">
            Veyra links out to these services — it does not host, proxy or record their streams.
            Availability data from TMDB (JustWatch) for {region}.
          </p>
        </div>
      )}

      {/* Archive.org copies */}
      {matches.length > 0 && !compact && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Search size={13} className="text-amber-300" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300">
              On the Internet Archive
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2" style={{ scrollbarWidth: 'none' }}>
            {matches.map((item) => (
              <SourceCard key={item.id} item={item} size="sm" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProviderChip({
  name,
  logoUrl,
  href,
  muted = false,
}: {
  name: string;
  logoUrl?: string;
  href: string;
  muted?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
        muted
          ? 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
          : 'bg-emerald-500/10 border-emerald-400/20 text-white hover:bg-emerald-500/20'
      }`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-4 h-4 rounded" referrerPolicy="no-referrer" />
      ) : null}
      {name}
      <ExternalLink size={11} className="opacity-60" />
    </a>
  );
}
