// ─────────────────────────────────────────────────────────────────────────────
// Source registry — the single place the app asks "where can I watch this?"
// ─────────────────────────────────────────────────────────────────────────────

import { archiveSource } from './archive';
import { youtubeSource, extractVideoId } from './youtube';
import { externalSource } from './external';
import type {
  AggregatedSearchResult,
  CuratedRow,
  MediaSource,
  Playable,
  SourceItem,
  SourceProviderId,
  SourceSearchOptions,
} from './types';

export * from './types';
export { archiveSource } from './archive';
export { youtubeSource, embedUrl, extractVideoId, playlistEmbedUrl, watchUrl } from './youtube';
export {
  externalSource,
  fetchWatchProviders,
  watchProvidersToItems,
  defaultRegion,
  setRegion,
  providerLogoUrl,
  type WatchProvider,
  type WatchProviderInfo,
} from './external';

const SOURCES: MediaSource[] = [archiveSource, youtubeSource, externalSource];

export function getSources(): MediaSource[] {
  return SOURCES;
}

export function getSource(id: SourceProviderId): MediaSource | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Providers that can actually do something in this build. */
export function getAvailableSources(): MediaSource[] {
  return SOURCES.filter((s) => s.available());
}

export function getSearchableSources(): MediaSource[] {
  return SOURCES.filter((s) => s.capabilities.search && s.available());
}

export function providerLabel(id: SourceProviderId): string {
  if (id === 'veyra') return 'Veyra';
  return getSource(id)?.shortName ?? id;
}

export function providerBadgeClass(id: SourceProviderId): string {
  return (
    getSource(id)?.badgeClass ??
    'bg-primary/15 text-primary border-primary/25'
  );
}

/**
 * The download decision, in one place.
 *
 * A file may be saved locally only when the provider's policy allows it AND the
 * resolver actually handed us download targets. YouTube therefore always
 * returns false, and Archive.org returns false for items whose rights could not
 * be verified — the UI explains both cases instead of silently failing.
 */
export function downloadStatus(
  source: MediaSource | undefined,
  playable?: Playable | null
): { allowed: boolean; reason?: string } {
  if (!source) return { allowed: false, reason: 'Unknown source' };
  if (source.capabilities.download === 'blocked') {
    return {
      allowed: false,
      reason:
        source.id === 'youtube'
          ? 'YouTube does not permit downloads outside its own app.'
          : `${source.name} does not permit downloads.`,
    };
  }
  if (!playable) return { allowed: false, reason: 'Still resolving this title…' };
  const targets = playable.downloadTargets ?? [];
  if (targets.length === 0) {
    return {
      allowed: false,
      reason:
        'Rights on this item could not be verified, so Veyra will not save it. Stream it instead.',
    };
  }
  return { allowed: true };
}

// ── Aggregated search ───────────────────────────────────────────────────────

/**
 * Fan a query out to every searchable provider in parallel. One provider being
 * slow, keyless or offline never blocks the others — each group reports its own
 * error so the UI can say "YouTube unavailable" next to real Archive results.
 */
export async function searchAll(
  query: string,
  opts: SourceSearchOptions = {}
): Promise<AggregatedSearchResult[]> {
  const providers = getSearchableSources();
  const started = Date.now();

  const settled = await Promise.allSettled(
    providers.map(async (source): Promise<AggregatedSearchResult> => {
      const t0 = Date.now();
      const result = await source.search(query, { ...opts, limit: opts.limit ?? 18 });
      return {
        query,
        provider: source.id,
        items: result.items,
        error: result.error,
        tookMs: Date.now() - t0,
      };
    })
  );

  const groups = settled.map((entry, index) =>
    entry.status === 'fulfilled'
      ? entry.value
      : {
          query,
          provider: providers[index].id,
          items: [] as SourceItem[],
          error: entry.reason instanceof Error ? entry.reason.message : 'Search failed',
          tookMs: Date.now() - started,
        }
  );

  // Stable, useful ordering: providers with results first, most items first.
  return groups.sort((a, b) => b.items.length - a.items.length);
}

export async function searchProvider(
  provider: SourceProviderId,
  query: string,
  opts: SourceSearchOptions = {}
) {
  const source = getSource(provider);
  if (!source) return null;
  return source.search(query, opts);
}

export async function resolvePlayable(
  provider: SourceProviderId,
  id: string,
  opts?: { episodeId?: string }
): Promise<Playable | null> {
  const source = getSource(provider);
  if (!source) return null;
  if (provider === 'youtube') {
    const videoId = extractVideoId(id);
    if (!videoId) return null;
    return source.resolve(videoId, opts);
  }
  return source.resolve(id, opts);
}

/** Homepage shelves from every provider that curates content. */
export async function curatedRows(): Promise<CuratedRow[]> {
  const providers = SOURCES.filter((s) => s.curated && s.available());
  const settled = await Promise.allSettled(providers.map((s) => s.curated!()));
  return settled.flatMap((entry, index) =>
    entry.status === 'fulfilled'
      ? entry.value
      : [{ key: `${providers[index].id}-error`, title: providers[index].name, items: [], error: 'unavailable' }]
  ).filter((row) => row.items.length > 0);
}

// ── Veyra's own catalog (R2-hosted uploads) as a source ─────────────────────

/**
 * Wraps the existing Veyra catalog in the same SourceItem shape so search
 * results from your own R2 uploads sit alongside Archive.org and YouTube
 * without the UI knowing the difference.
 */
export async function searchCatalog(
  query: string,
  limit = 18
): Promise<AggregatedSearchResult> {
  const t0 = Date.now();
  try {
    const { api } = await import('@/lib/api');
    const res = await api.search(query, { limit });
    const items: SourceItem[] = res.results.map((movie) => ({
      provider: 'veyra' as SourceProviderId,
      id: String(movie.id),
      title: movie.title,
      year: movie.year,
      description: movie.shortDescription || movie.description,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      durationSec: movie.duration,
      kind: movie.type === 'series' ? ('series' as const) : ('movie' as const),
      license: 'Veyra library',
      sourceUrl: `/movie/${movie.slug}`,
      meta: { slug: movie.slug, imdbRating: movie.imdbRating, voteAverage: movie.voteAverage },
    }));
    return { query, provider: 'veyra', items, tookMs: Date.now() - t0 };
  } catch (err) {
    return {
      query,
      provider: 'veyra',
      items: [],
      error: err instanceof Error ? err.message : 'Catalog search failed',
      tookMs: Date.now() - t0,
    };
  }
}

/**
 * Search everything at once: the Veyra catalog plus every external provider.
 * Catalog results are listed first because they are the titles you host.
 */
export async function searchEverywhere(
  query: string,
  opts: SourceSearchOptions = {}
): Promise<AggregatedSearchResult[]> {
  const [catalog, external] = await Promise.all([
    searchCatalog(query, opts.limit ?? 18),
    searchAll(query, opts),
  ]);
  return catalog.items.length || catalog.error ? [catalog, ...external] : external;
}
