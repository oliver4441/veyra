// ─────────────────────────────────────────────────────────────────────────────
// Veyra Source Provider Abstraction
// ─────────────────────────────────────────────────────────────────────────────
// A "source" is any external platform Veyra can surface a title from.
//
// The critical idea: every source declares its own capabilities and its own
// download policy, so the UI never has to hard-code "Archive.org can download
// but YouTube cannot". Adding a provider means adding a file in this folder —
// nothing in the player, search page or download queue changes.
//
// Legality is modelled, not assumed:
//   - archive.org  → stream + download (public domain / Creative Commons)
//   - youtube      → official iframe embed only, downloads NOT permitted by ToS
//   - external     → Tubi / Pluto / Plex / Crackle / Kanopy … link-out only
//                    (they publish no embed API and forbid redistribution)
// ─────────────────────────────────────────────────────────────────────────────

export type SourceProviderId = 'archive' | 'youtube' | 'external' | 'veyra';

/** How the player should present this item. */
export type PlaybackKind =
  | 'video' // direct progressive file (mp4/webm) → <video src>
  | 'hls' // .m3u8 → hls.js
  | 'iframe' // official embed (YouTube / archive.org)
  | 'external'; // deep link out to another app or website

/**
 * Whether a source may be saved to local storage.
 * `allowed`  – the provider's terms permit downloading these files.
 * `blocked`  – the provider forbids it (YouTube) — the UI shows why.
 */
export type DownloadPolicy = 'allowed' | 'blocked';

export interface SourceCapabilities {
  /** Provider exposes a search endpoint we can call. */
  search: boolean;
  /** Provider offers an official embeddable player. */
  embed: boolean;
  /** Provider serves raw media files a <video> element can play. */
  directPlayback: boolean;
  /** Provider supports multi-episode titles (series / playlists). */
  series: boolean;
  /** Provider can return subtitle/caption tracks. */
  subtitles: boolean;
  /** Download policy applied to everything from this provider. */
  download: DownloadPolicy;
  /** True when the provider needs an API key we may not have. */
  requiresKey: boolean;
  /** True when calls go straight from the browser (CORS-enabled API). */
  browserDirect: boolean;
}

export interface SourceItem {
  provider: SourceProviderId;
  /** Provider-native identifier (archive.org identifier, YouTube videoId…). */
  id: string;
  title: string;
  year?: number;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  durationSec?: number;
  kind: 'movie' | 'series';
  /** Human-readable rights statement, e.g. "Public Domain", "CC BY". */
  license?: string;
  licenseUrl?: string;
  /** Canonical page on the provider's own site (attribution + fallback). */
  sourceUrl?: string;
  /** Provider the title should be watched on (external link-outs only). */
  externalProvider?: string;
  externalLogoUrl?: string;
  /** Relevance/popularity hint used when merging results from several sources. */
  score?: number;
  creator?: string;
  /** Anything provider-specific the detail page might want. */
  meta?: Record<string, unknown>;
}

export interface SourceSearchResult {
  provider: SourceProviderId;
  query: string;
  items: SourceItem[];
  page: number;
  totalPages?: number;
  totalResults?: number;
  /** Set when the provider could not be reached — the UI degrades quietly. */
  error?: string;
}

export interface DownloadTarget {
  /** Absolute URL of the file. Must be fetchable without CORS on native. */
  url: string;
  filename: string;
  sizeBytes?: number;
  quality?: string;
  mimeType?: string;
  /** Seconds of media, when known — used for "1 episode of 24 min" labels. */
  durationSec?: number;
}

export interface SourceEpisode {
  id: string;
  number: number;
  season?: number;
  title: string;
  description?: string;
  durationSec?: number;
  thumbnailUrl?: string;
  playable: Playable;
  downloadTargets?: DownloadTarget[];
}

export interface Playable {
  provider: SourceProviderId;
  id: string;
  kind: PlaybackKind;
  /** Embed URL (iframe) or media URL (video/hls). Empty for `external`. */
  url: string;
  title?: string;
  posterUrl?: string;
  /** Where to send the user when kind === 'external'. */
  externalUrl?: string;
  externalProvider?: string;
  /** Best available progressive file(s) for offline saving. */
  downloadTargets?: DownloadTarget[];
  episodes?: SourceEpisode[];
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
  /** Provider-specific extras (e.g. the full watch-provider list). */
  meta?: Record<string, unknown>;
}

export interface CuratedRow {
  key: string;
  title: string;
  subtitle?: string;
  items: SourceItem[];
  loading?: boolean;
  error?: string;
}

export interface MediaSource {
  id: SourceProviderId;
  name: string;
  shortName: string;
  /** One-line description shown in Settings → Sources. */
  description: string;
  /** Tailwind-friendly accent used for the provider badge. */
  badgeClass: string;
  capabilities: SourceCapabilities;
  /** False when the provider is configured but unusable (e.g. missing key). */
  available(): boolean;
  search(query: string, opts?: SourceSearchOptions): Promise<SourceSearchResult>;
  /** Resolve a provider-native id into something the player can use. */
  resolve(id: string, opts?: { episodeId?: string }): Promise<Playable | null>;
  /**
   * Fetch the catalogue-level description of one item. Used by the detail page
   * when someone arrives from a direct link with nothing but a provider + id.
   */
  describe?(id: string): Promise<SourceItem | null>;
  /** Hand-picked/catalogue rows for the homepage. */
  curated?(): Promise<CuratedRow[]>;
  attribution?: string;
}

export interface SourceSearchOptions {
  page?: number;
  limit?: number;
  kind?: 'movie' | 'series' | 'all';
  /** Restrict to full-length films where the provider can tell the difference. */
  featureFilmsOnly?: boolean;
  signal?: AbortSignal;
}

/** Shape returned by the aggregated multi-source search. */
export interface AggregatedSearchResult {
  query: string;
  provider: SourceProviderId;
  items: SourceItem[];
  error?: string;
  tookMs: number;
}
