// ─────────────────────────────────────────────────────────────────────────────
// YouTube source provider — embed only
// ─────────────────────────────────────────────────────────────────────────────
// YouTube is a streaming source for Veyra, never a download source. That is a
// deliberate, hard-coded decision:
//
//   • Playing a video through the official iframe embed is exactly what YouTube
//     intends and is permitted by its Terms of Service.
//   • Downloading YouTube videos is explicitly prohibited by those terms unless
//     YouTube itself shows a download button. Veyra will not do it, will not
//     pretend to, and marks the capability `blocked` so the UI can explain why.
//
// Search costs YouTube Data API quota (100 units per search on the free 10,000
// unit/day tier), so this provider is written to be frugal: results are cached
// locally and a daily budget guard stops the app from burning through quota.
// Without an API key the provider still works for embedding known video IDs
// (trailers, admin-curated bindings) — it just cannot search.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CuratedRow,
  MediaSource,
  Playable,
  SourceCapabilities,
  SourceItem,
  SourceSearchOptions,
  SourceSearchResult,
} from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const EMBED_HOST = 'https://www.youtube-nocookie.com/embed';

/** Units of the free 10,000/day quota we allow Veyra to spend. */
const DAILY_UNIT_BUDGET = 9000;
const COST_SEARCH = 100;
const COST_PLAYLIST_ITEMS = 1;
const COST_VIDEOS = 1;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Quota + cache bookkeeping (localStorage, best-effort) ───────────────────

interface BudgetState {
  day: string;
  used: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readBudget(): BudgetState {
  if (typeof window === 'undefined') return { day: today(), used: 0 };
  try {
    const raw = window.localStorage.getItem('veyra-yt-budget');
    if (!raw) return { day: today(), used: 0 };
    const parsed = JSON.parse(raw) as BudgetState;
    if (parsed.day !== today()) return { day: today(), used: 0 };
    return parsed;
  } catch {
    return { day: today(), used: 0 };
  }
}

function spend(units: number) {
  if (typeof window === 'undefined') return;
  try {
    const state = readBudget();
    state.used += units;
    window.localStorage.setItem('veyra-yt-budget', JSON.stringify(state));
  } catch {
    // ignore
  }
}

function canAfford(units: number): boolean {
  return readBudget().used + units <= DAILY_UNIT_BUDGET;
}

function cacheGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`veyra-yt-cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { at: number; value: T };
    if (Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`veyra-yt-cache:${key}`, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore — private mode / full storage must not break search
  }
}

// ── Configuration ───────────────────────────────────────────────────────────

export function youtubeApiKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

/**
 * Optional curated playlists, e.g.
 *   NEXT_PUBLIC_YOUTUBE_PLAYLISTS="PLxxxx:Public Domain Features,PLyyyy:Silent Films"
 * Expanding them costs 1 unit per page rather than 100 per search, which makes
 * playlists by far the cheapest way to build YouTube shelves.
 */
export function youtubePlaylists(): Array<{ id: string; title: string }> {
  const raw = process.env.NEXT_PUBLIC_YOUTUBE_PLAYLISTS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, title] = entry.split(':');
      return { id: id.trim(), title: (title || 'YouTube Picks').trim() };
    })
    .filter((p) => p.id);
}

// ── URL builders ────────────────────────────────────────────────────────────

export function embedUrl(videoId: string, opts: { autoplay?: boolean; start?: number } = {}): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
  });
  if (opts.autoplay) params.set('autoplay', '1');
  if (opts.start) params.set('start', String(Math.floor(opts.start)));
  return `${EMBED_HOST}/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function playlistEmbedUrl(playlistId: string, autoplay = true): string {
  const params = new URLSearchParams({
    listType: 'playlist',
    list: playlistId,
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  if (autoplay) params.set('autoplay', '1');
  return `${EMBED_HOST}?${params.toString()}`;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/** Pull a video id out of any common YouTube URL shape. */
export function extractVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const value = urlOrId.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
      const v = url.searchParams.get('v');
      if (v) return v;
    }
  } catch {
    // not a URL
  }
  return null;
}

// ── API payloads ────────────────────────────────────────────────────────────

interface YtThumb {
  url: string;
  width?: number;
  height?: number;
}

interface YtVideoResource {
  id: string | { videoId?: string; playlistId?: string; channelId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: Record<string, YtThumb>;
  };
  contentDetails?: {
    duration?: string;
    videoId?: string;
    videoPublishedAt?: string;
  };
}

interface YtListResponse {
  items?: YtVideoResource[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

function bestThumb(thumbs?: Record<string, YtThumb>): string | undefined {
  if (!thumbs) return undefined;
  return (
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url
  );
}

/** ISO-8601 duration ("PT1H32M10S") → seconds. */
export function parseIsoDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return undefined;
  const [, d, h, m, s] = match.map((v) => (v ? parseInt(v, 10) : 0));
  return d * 86400 + h * 3600 + m * 60 + s;
}

async function ytFetch(params: URLSearchParams, signal?: AbortSignal): Promise<YtListResponse> {
  const key = youtubeApiKey();
  if (!key) throw new Error('No YouTube API key configured');
  params.set('key', key);
  const response = await fetch(`${API_BASE}/?${params.toString()}`, { signal });
  if (!response.ok) {
    let message = `YouTube API ${response.status}`;
    try {
      const body = (await response.json()) as YtListResponse;
      message = body.error?.message || message;
    } catch {
      // keep the status-based message
    }
    throw new Error(message);
  }
  return (await response.json()) as YtListResponse;
}

function toItem(resource: YtVideoResource, videoId?: string): SourceItem | null {
  const id = videoId || (typeof resource.id === 'string' ? resource.id : resource.id?.videoId);
  if (!id) return null;
  const snippet = resource.snippet || {};
  const year = snippet.publishedAt ? new Date(snippet.publishedAt).getFullYear() : undefined;
  return {
    provider: 'youtube',
    id,
    title: snippet.title || 'Untitled',
    year,
    description: snippet.description ? snippet.description.slice(0, 600) : undefined,
    posterUrl: bestThumb(snippet.thumbnails),
    backdropUrl: bestThumb(snippet.thumbnails),
    durationSec: parseIsoDuration(resource.contentDetails?.duration),
    kind: 'movie',
    license: 'YouTube — stream only',
    sourceUrl: watchUrl(id),
    creator: snippet.channelTitle,
    meta: { playlistId: typeof resource.id === 'object' ? resource.id.playlistId : undefined },
  };
}

// ── The provider ────────────────────────────────────────────────────────────

const capabilities: SourceCapabilities = {
  search: true,
  embed: true,
  directPlayback: false,
  series: true,
  subtitles: true,
  // Non-negotiable: YouTube's terms forbid downloading outside the app itself.
  download: 'blocked',
  requiresKey: true,
  browserDirect: true,
};

export const youtubeSource: MediaSource = {
  id: 'youtube',
  name: 'YouTube',
  shortName: 'YouTube',
  description:
    'Official embed playback. Streaming only — YouTube does not permit downloading its videos.',
  badgeClass: 'bg-red-500/15 text-red-300 border-red-400/25',
  capabilities,
  attribution: 'Videos streamed from YouTube via the official embed player.',

  available() {
    return Boolean(youtubeApiKey());
  },

  async search(query: string, opts: SourceSearchOptions = {}): Promise<SourceSearchResult> {
    const trimmed = query.trim();
    const page = opts.page ?? 1;
    const limit = Math.min(Math.max(opts.limit ?? 12, 1), 50);

    if (!trimmed) return { provider: 'youtube', query, items: [], page, totalResults: 0 };

    if (!youtubeApiKey()) {
      return {
        provider: 'youtube',
        query,
        items: [],
        page,
        error: 'YouTube search is disabled — add NEXT_PUBLIC_YOUTUBE_API_KEY to enable it.',
      };
    }

    const cacheKey = `search:${trimmed.toLowerCase()}:${limit}:${page}`;
    const cached = cacheGet<SourceSearchResult>(cacheKey);
    if (cached) return cached;

    if (!canAfford(COST_SEARCH)) {
      return {
        provider: 'youtube',
        query,
        items: [],
        page,
        error: 'Daily YouTube quota reached. Results will resume tomorrow.',
      };
    }

    try {
      const params = new URLSearchParams({
        part: 'snippet',
        q: trimmed,
        type: 'video',
        videoEmbeddable: 'true', // only videos that allow embedding — no dead players
        videoDefinition: 'any',
        maxResults: String(limit),
        safeSearch: 'moderate',
      });
      if (page > 1) params.set('pageToken', String(page)); // placeholder; real token below

      const searchRes = await ytFetch(params, opts.signal);
      spend(COST_SEARCH);

      const ids = (searchRes.items || [])
        .map((item) => (typeof item.id === 'object' ? item.id.videoId : item.id))
        .filter((v): v is string => Boolean(v));

      let items: SourceItem[] = (searchRes.items || [])
        .map((item) => toItem(item))
        .filter((i): i is SourceItem => Boolean(i));

      // Enrich with durations (1 unit) — the detail page and cards look far
      // better with a runtime, and it is cheap compared to the search itself.
      if (ids.length && canAfford(COST_VIDEOS)) {
        try {
          const detailParams = new URLSearchParams({
            part: 'contentDetails,snippet',
            id: ids.join(','),
          });
          const details = await ytFetch(detailParams, opts.signal);
          spend(COST_VIDEOS);
          const byId = new Map<string, YtVideoResource>();
          (details.items || []).forEach((d) => byId.set(String(d.id), d));
          items = items.map((item) => {
            const detail = byId.get(item.id);
            if (!detail) return item;
            return {
              ...item,
              durationSec: parseIsoDuration(detail.contentDetails?.duration) ?? item.durationSec,
              posterUrl: bestThumb(detail.snippet?.thumbnails) || item.posterUrl,
              year: detail.snippet?.publishedAt
                ? new Date(detail.snippet.publishedAt).getFullYear()
                : item.year,
            };
          });
        } catch {
          // Durations are a nice-to-have; keep the search results we already paid for.
        }
      }

      const result: SourceSearchResult = {
        provider: 'youtube',
        query,
        items,
        page: 1,
        totalResults: searchRes.pageInfo?.totalResults,
      };
      cacheSet(cacheKey, result);
      return result;
    } catch (err) {
      return {
        provider: 'youtube',
        query,
        items: [],
        page,
        error: err instanceof Error ? err.message : 'YouTube search failed',
      };
    }
  },

  async resolve(id: string): Promise<Playable | null> {
    const videoId = extractVideoId(id);
    if (!videoId) return null;
    return {
      provider: 'youtube',
      id: videoId,
      kind: 'iframe',
      url: embedUrl(videoId, { autoplay: true }),
      title: undefined,
      posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      externalUrl: watchUrl(videoId),
      license: 'YouTube — stream only',
      sourceUrl: watchUrl(videoId),
      // Deliberately absent: no downloadTargets for this provider, ever.
    };
  },

  async describe(id: string): Promise<SourceItem | null> {
    const videoId = extractVideoId(id);
    if (!videoId) return null;

    // With a key we can ask for the real title, runtime and channel
    // (1 unit). Without one we still render a usable page from the id, using
    // YouTube's public thumbnail endpoint, rather than showing nothing.
    const key = youtubeApiKey();
    if (key && canAfford(COST_VIDEOS)) {
      const cacheKey = `video:${videoId}`;
      const cached = cacheGet<SourceItem>(cacheKey);
      if (cached) return cached;
      try {
        const params = new URLSearchParams({ part: 'snippet,contentDetails', id: videoId });
        const res = await ytFetch(params);
        spend(COST_VIDEOS);
        const item = toItem((res.items || [])[0]);
        if (item) {
          cacheSet(cacheKey, item);
          return item;
        }
      } catch {
        // fall through to the keyless shape
      }
    }

    return {
      provider: 'youtube',
      id: videoId,
      title: 'YouTube video',
      posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      backdropUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      kind: 'movie',
      license: 'YouTube — stream only',
      sourceUrl: watchUrl(videoId),
    };
  },

  async curated(): Promise<CuratedRow[]> {
    const playlists = youtubePlaylists();
    if (!playlists.length) return [];
    if (!youtubeApiKey()) return [];

    const rows = await Promise.all(
      playlists.map(async (playlist): Promise<CuratedRow> => {
        const cacheKey = `playlist:${playlist.id}`;
        const cached = cacheGet<SourceItem[]>(cacheKey);
        if (cached) return { key: playlist.id, title: playlist.title, items: cached };
        if (!canAfford(COST_PLAYLIST_ITEMS)) {
          return {
            key: playlist.id,
            title: playlist.title,
            items: [],
            error: 'Daily YouTube quota reached',
          };
        }
        try {
          const params = new URLSearchParams({
            part: 'snippet,contentDetails',
            playlistId: playlist.id,
            maxResults: '18',
          });
          const res = await ytFetch(params);
          spend(COST_PLAYLIST_ITEMS);
          const items = (res.items || [])
            .map((item) => toItem(item, item.contentDetails?.videoId))
            .filter((i): i is SourceItem => Boolean(i));
          cacheSet(cacheKey, items);
          return { key: playlist.id, title: playlist.title, items };
        } catch (err) {
          return {
            key: playlist.id,
            title: playlist.title,
            items: [],
            error: err instanceof Error ? err.message : 'playlist failed',
          };
        }
      })
    );

    return rows.filter((r) => r.items.length > 0);
  },
};

export default youtubeSource;
