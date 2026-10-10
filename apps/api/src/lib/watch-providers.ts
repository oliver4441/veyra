// ─────────────────────────────────────────────────────────────────────────────
// Watch providers — "where can this legally be streamed?"
// ─────────────────────────────────────────────────────────────────────────────
// TMDB exposes JustWatch's availability data. That is how Veyra can surface
// Tubi, Pluto TV, Plex, Crackle, Kanopy and the rest without ever touching their
// streams: we return the platform name, its logo, whether the title is free /
// ad-supported / subscription, and TMDB's region-aware link to the platform.
//
// The TMDB token stays on the Worker — the browser never sees it.
// ─────────────────────────────────────────────────────────────────────────────

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

export type WatchProviderType = 'free' | 'ads' | 'flatrate' | 'rent' | 'buy';

export interface WatchProvider {
  providerId: number;
  name: string;
  logoUrl?: string;
  type: WatchProviderType;
  displayPriority?: number;
}

export interface WatchProviderInfo {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  region: string;
  link: string;
  providers: WatchProvider[];
  free: WatchProvider[];
  subscription: WatchProvider[];
  rentOrBuy: WatchProvider[];
}

interface TMDBProviderEntry {
  display_priority?: number;
  logo_path?: string;
  provider_id?: number;
  provider_name?: string;
}

interface TMDBCountryResult {
  link?: string;
  free?: TMDBProviderEntry[];
  ads?: TMDBProviderEntry[];
  flatrate?: TMDBProviderEntry[];
  rent?: TMDBProviderEntry[];
  buy?: TMDBProviderEntry[];
}

interface TMDBWatchProvidersResponse {
  id?: number;
  results?: Record<string, TMDBCountryResult>;
}

/** Regions we fall back through when the requested one has no data at all. */
const FALLBACK_REGIONS = ['US', 'GB'];

function normalize(
  entries: TMDBProviderEntry[] | undefined,
  type: WatchProviderType
): WatchProvider[] {
  if (!entries) return [];
  return entries
    .filter((entry) => entry.provider_id && entry.provider_name)
    .map((entry) => ({
      providerId: entry.provider_id as number,
      name: entry.provider_name as string,
      logoUrl: entry.logo_path ? `${TMDB_IMAGE_BASE}${entry.logo_path}` : undefined,
      type,
      displayPriority: entry.display_priority,
    }));
}

function mergeAndSort(...lists: WatchProvider[][]): WatchProvider[] {
  const seen = new Set<string>();
  const merged: WatchProvider[] = [];
  lists.flat().forEach((provider) => {
    const key = `${provider.providerId}:${provider.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(provider);
  });
  return merged.sort((a, b) => (a.displayPriority ?? 99) - (b.displayPriority ?? 99));
}

/**
 * One call returns availability for every country TMDB knows about, keyed by
 * ISO-3166-1 code — there is no region parameter to send.
 */
async function fetchAllRegions(
  token: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number
): Promise<TMDBWatchProvidersResponse | null> {
  const response = await fetch(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}/watch/providers`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as TMDBWatchProvidersResponse;
}

/**
 * Build the availability payload for one title in one region.
 * Returns null when TMDB is unreachable or the title is unknown.
 */
export async function getWatchProviders(
  token: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  region = 'US'
): Promise<WatchProviderInfo | null> {
  if (!token) return null;
  const wanted = (region || 'US').toUpperCase().slice(0, 2);

  const data = await fetchAllRegions(token, mediaType, tmdbId);
  if (!data?.results) return null;

  let usedRegion = wanted;
  // A title with no data for the requested country is common outside the US, so
  // fall back rather than telling the visitor "nowhere".
  if (!data.results[usedRegion]) {
    const fallback = FALLBACK_REGIONS.find((candidate) => data.results?.[candidate]);
    if (!fallback) return null;
    usedRegion = fallback;
  }

  const country = data.results[usedRegion];
  if (!country) return null;

  const free = mergeAndSort(normalize(country.free, 'free'), normalize(country.ads, 'ads'));
  const subscription = normalize(country.flatrate, 'flatrate');
  const rentOrBuy = mergeAndSort(normalize(country.rent, 'rent'), normalize(country.buy, 'buy'));

  return {
    tmdbId,
    mediaType,
    region: usedRegion,
    link:
      country.link ||
      `https://www.themoviedb.org/${mediaType}/${tmdbId}/watch?locale=${usedRegion}`,
    providers: mergeAndSort(free, subscription, rentOrBuy),
    free,
    subscription,
    rentOrBuy,
  };
}
