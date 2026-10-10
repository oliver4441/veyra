// ─────────────────────────────────────────────────────────────────────────────
// External platforms (Tubi, Pluto TV, Plex, Crackle, Kanopy, …) — link-out only
// ─────────────────────────────────────────────────────────────────────────────
// These services are free and legal, but none of them publish a public embed
// API, all of them forbid redistribution in their terms, and most are
// geo-locked. So Veyra does not proxy or embed them.
//
// What it does instead is the honest, compliant thing: TMDB's
// `/watch/providers` endpoint (JustWatch data, and you already hold a TMDB
// token) tells us exactly which services legally stream a given title in the
// user's region. Veyra shows that as a "Watch free on Tubi ↗" button and hands
// the user off to the platform's own app or site.
//
// Everything here goes through the Cloudflare Worker because the TMDB token is
// a server-side secret. With no backend configured the source simply reports
// itself unavailable and the UI hides it.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MediaSource,
  Playable,
  SourceCapabilities,
  SourceItem,
  SourceSearchResult,
} from './types';

export type WatchProviderType = 'free' | 'ads' | 'flatrate' | 'rent' | 'buy';

export interface WatchProvider {
  providerId: number;
  name: string;
  logoUrl?: string;
  /** How the title is offered on this service. */
  type: WatchProviderType;
  displayPriority?: number;
}

export interface WatchProviderInfo {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  region: string;
  /** TMDB's "just watch" page — always present, works in every region. */
  link: string;
  providers: WatchProvider[];
  free: WatchProvider[];
  subscription: WatchProvider[];
  rentOrBuy: WatchProvider[];
}

const LOGO_BASE = 'https://image.tmdb.org/t/p/original';

/** Region used until the visitor picks one. Overridable at build time. */
export function defaultRegion(): string {
  const configured = process.env.NEXT_PUBLIC_WATCH_REGION;
  if (configured && configured.trim()) return configured.trim().toUpperCase();
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('veyra-region');
      if (stored && /^[a-z]{2}$/i.test(stored)) return stored.toUpperCase();
    } catch {
      // ignore
    }
  }
  return 'US';
}

export function setRegion(region: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('veyra-region', region.toUpperCase().slice(0, 2));
  } catch {
    // ignore
  }
}

/**
 * Ask the Veyra API which services legally stream a title in `region`.
 * Returns null (never throws) so callers can degrade quietly.
 */
export async function fetchWatchProviders(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  region = defaultRegion()
): Promise<WatchProviderInfo | null> {
  try {
    const { api } = await import('@/lib/api');
    const res = await api.request<{ providers: WatchProviderInfo }>(
      `/api/discovery/${mediaType}/${tmdbId}/watch-providers?region=${encodeURIComponent(region)}`
    );
    return res.providers ?? null;
  } catch {
    return null;
  }
}

function providerToItem(provider: WatchProvider, info: WatchProviderInfo): SourceItem {
  const typeLabel =
    provider.type === 'free'
      ? 'Free'
      : provider.type === 'ads'
        ? 'Free with ads'
        : provider.type === 'flatrate'
          ? 'Subscription'
          : 'Rent or buy';
  return {
    provider: 'external',
    id: `${info.tmdbId}:${info.mediaType}:${provider.providerId}`,
    title: provider.name,
    kind: info.mediaType === 'tv' ? 'series' : 'movie',
    externalProvider: provider.name,
    externalLogoUrl: provider.logoUrl,
    license: typeLabel,
    sourceUrl: info.link,
    description: `Stream legally on ${provider.name} (${typeLabel}) in ${info.region}.`,
    meta: { tmdbId: info.tmdbId, mediaType: info.mediaType, region: info.region, type: provider.type },
  };
}

const capabilities: SourceCapabilities = {
  search: false,
  embed: false,
  directPlayback: false,
  series: true,
  subtitles: false,
  // We never hold these files — the platform's own app streams them.
  download: 'blocked',
  requiresKey: true,
  browserDirect: false,
};

export const externalSource: MediaSource = {
  id: 'external',
  name: 'Other free platforms',
  shortName: 'Link-out',
  description:
    'Tubi, Pluto TV, Plex, Crackle, Kanopy and friends — surfaced as legal deep links via TMDB, never embedded.',
  badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/25',
  capabilities,
  attribution: 'Streaming availability data provided by TMDB (JustWatch).',

  available() {
    // Needs the Worker (TMDB token is server-side only).
    return Boolean(process.env.NEXT_PUBLIC_API_URL);
  },

  async search(query: string): Promise<SourceSearchResult> {
    // Discovery of external titles happens through TMDB search, not here.
    return { provider: 'external', query, items: [], page: 1 };
  },

  /**
   * `id` is either `tmdbId:mediaType[:providerId]` or a bare TMDB id (movie).
   */
  async resolve(id: string): Promise<Playable | null> {
    const [tmdbPart, mediaPart] = id.split(':');
    const tmdbId = parseInt(tmdbPart, 10);
    if (!tmdbId) return null;
    const mediaType = mediaPart === 'tv' ? 'tv' : 'movie';
    const info = await fetchWatchProviders(tmdbId, mediaType);
    if (!info) return null;

    const best = info.free[0] || info.providers[0];
    return {
      provider: 'external',
      id,
      kind: 'external',
      url: '',
      externalUrl: info.link,
      externalProvider: best?.name,
      title: best ? `Watch on ${best.name}` : 'Where to watch',
      sourceUrl: info.link,
      license: best ? best.name : undefined,
      meta: {
        providers: info.providers.map((p) => ({
          ...p,
          ...({ posterUrl: p.logoUrl } as Record<string, unknown>),
        })),
        free: info.free,
        region: info.region,
      },
    };
  },
};

/** Turn a TMDB watch-provider payload into cards for the source shelf. */
export function watchProvidersToItems(info: WatchProviderInfo): SourceItem[] {
  return info.providers.map((p) => providerToItem(p, info));
}

export function providerLogoUrl(logoPath?: string): string | undefined {
  if (!logoPath) return undefined;
  if (logoPath.startsWith('http')) return logoPath;
  return `${LOGO_BASE}${logoPath}`;
}

export default externalSource;
