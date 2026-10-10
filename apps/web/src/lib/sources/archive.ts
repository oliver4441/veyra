// ─────────────────────────────────────────────────────────────────────────────
// Internet Archive (archive.org) source provider
// ─────────────────────────────────────────────────────────────────────────────
// The primary free-media source for Veyra: thousands of public-domain and
// Creative Commons feature films, all legally streamable AND downloadable.
//
// Why this one works so well:
//   • Official, keyless JSON APIs — no signup, no quota.
//   • Search + metadata endpoints send `Access-Control-Allow-Origin: *`, so the
//     browser (and the Capacitor WebView) can call them directly.
//   • Every item exposes direct file URLs under /download/{id}/{file}, which a
//     native downloader can fetch without any CORS involvement at all.
//   • /embed/{id} gives an official iframe player as a fallback.
//
// Docs: https://archive.org/developers/
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CuratedRow,
  DownloadTarget,
  MediaSource,
  Playable,
  SourceCapabilities,
  SourceEpisode,
  SourceItem,
  SourceSearchOptions,
  SourceSearchResult,
} from './types';

const BASE = 'https://archive.org';

/** Fields we ask the search API to return. Keep it tight — fewer bytes. */
const SEARCH_FIELDS = [
  'identifier',
  'title',
  'year',
  'creator',
  'description',
  'downloads',
  'item_size',
  'licenseurl',
  'rights',
  'runtime',
  'avg_rating',
  'collection',
];

/**
 * Collections we treat as the "movies" part of the Archive. Anything outside
 * these is usually a clip, a lecture or a user upload.
 */
const FILM_COLLECTIONS = [
  'feature_films',
  'SciFi_Horror',
  'animationandcartoons',
  'classic_cartoons',
  'prelinger',
  'silent_films',
  'film_noir',
];

/**
 * Ranked list of Archive derivative formats that a browser / WebView can
 * actually play. Archive transcodes every upload to h.264 MP4, so the derived
 * `.mp4` files are almost always present and are what we want.
 */
const FORMAT_RANK: Record<string, number> = {
  'h.264 hd': 100,
  'h.264 ia': 96,
  'h.264': 94,
  'mpeg4': 80,
  '512kb mpeg4': 76,
  '256kb mpeg4': 70,
  'vbr webm': 66,
  webm: 64,
  'mp4 hi': 62,
};

/** Formats that never contain watchable video for us. */
const NON_VIDEO_HINTS = [
  'thumb',
  'metadata',
  'torrent',
  'spectrogram',
  'mp3',
  'm4a',
  'flac',
  'ogg audio',
  'vbr ogg',
  'jpeg',
  'png',
  'gif',
  'text',
  'epub',
  'mobi',
  'djvu',
  'cbr',
  'zip',
  'iso',
  'subtitle',
  'srt',
  'vtt',
  'closed caption',
  'scandata',
  'chocrtext',
  'abbyy',
];

// ── Types for the raw API payloads ──────────────────────────────────────────

interface ArchiveSearchDoc {
  identifier: string;
  title?: string | string[];
  year?: string | number;
  creator?: string | string[];
  description?: string | string[];
  downloads?: number;
  item_size?: number;
  licenseurl?: string;
  rights?: string;
  runtime?: string;
  avg_rating?: number | string;
  collection?: string | string[];
}

interface ArchiveFile {
  name: string;
  format?: string;
  size?: string;
  length?: string;
  width?: string | number;
  height?: string | number;
  source?: string;
  title?: string;
  track?: string;
  mtime?: string;
}

interface ArchiveMetadata {
  metadata?: Record<string, string | string[] | number>;
  files?: ArchiveFile[];
  server?: string;
  dir?: string;
  d1?: string;
  workableServers?: string[];
  isDark?: boolean;
}

// ── Small helpers ───────────────────────────────────────────────────────────

/** Archive descriptions are HTML fragments; the UI renders plain text. */
export function stripHtml(input?: string | string[]): string | undefined {
  if (!input) return undefined;
  const raw = Array.isArray(input) ? input.join(' ') : input;
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
}

function first(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Archive `length` arrives as "1:32:10", "32:10" or a bare number of seconds.
 */
export function parseDuration(length?: string | number): number | undefined {
  if (length === undefined || length === null || length === '') return undefined;
  if (typeof length === 'number') return Math.round(length);
  const trimmed = String(length).trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(parseFloat(trimmed));
  const parts = trimmed.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  return Math.round(
    parts.reduce((acc, part) => acc * 60 + part, 0)
  );
}

function rankFormat(format?: string): number {
  if (!format) return 0;
  const key = format.toLowerCase();
  return FORMAT_RANK[key] ?? 0;
}

function looksLikeVideo(file: ArchiveFile): boolean {
  const name = file.name.toLowerCase();
  const format = (file.format || '').toLowerCase();
  if (NON_VIDEO_HINTS.some((hint) => format.includes(hint))) return false;
  if (/\.(jpe?g|png|gif|bmp|webp|svg|txt|xml|json|zip|iso|torrent|srt|vtt|pdf|epub)$/i.test(name)) {
    return false;
  }
  if (rankFormat(format) > 0) return true;
  // Unknown/odd formats still count when the container is browser-friendly.
  return /\.(mp4|m4v|webm|mov)$/i.test(name);
}

function isSubtitle(file: ArchiveFile): boolean {
  return /\.(srt|vtt|ass|ssa)$/i.test(file.name) || /subtitle|closed caption/i.test(file.format || '');
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : 'mp4';
}

function guessMime(name: string): string {
  switch (extensionOf(name)) {
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
    case 'mp4':
    default:
      return 'video/mp4';
  }
}

function qualityOf(file: ArchiveFile): string | undefined {
  const height = parseInt(String(file.height || ''), 10);
  if (!height || Number.isNaN(height)) return undefined;
  if (height >= 2000) return '4k';
  if (height >= 1000) return '1080';
  if (height >= 650) return '720';
  if (height >= 400) return '480';
  return `${height}p`;
}

/**
 * Map an Archive license URL (or `rights` field) onto a human label.
 * This drives the rights badge and the download permission check.
 */
export function licenseInfo(meta?: Record<string, unknown>): {
  label: string;
  url?: string;
  open: boolean;
} {
  const url = typeof meta?.licenseurl === 'string' ? meta.licenseurl : undefined;
  const rights = stripHtml(
    typeof meta?.rights === 'string' ? meta.rights : first(meta?.rights as string[])
  );

  if (url) {
    const u = url.toLowerCase();
    if (u.includes('publicdomain') || u.includes('/pd/') || u.includes('zero')) {
      return { label: 'Public Domain', url, open: true };
    }
    if (u.includes('creativecommons.org/licenses/by-nc-nd')) {
      return { label: 'CC BY-NC-ND', url, open: true };
    }
    if (u.includes('creativecommons.org/licenses/by-nc-sa')) {
      return { label: 'CC BY-NC-SA', url, open: true };
    }
    if (u.includes('creativecommons.org/licenses/by-nc')) {
      return { label: 'CC BY-NC', url, open: true };
    }
    if (u.includes('creativecommons.org/licenses/by-sa')) {
      return { label: 'CC BY-SA', url, open: true };
    }
    if (u.includes('creativecommons.org/licenses/by')) {
      return { label: 'CC BY', url, open: true };
    }
    if (u.includes('creativecommons.org')) {
      return { label: 'Creative Commons', url, open: true };
    }
    return { label: 'See licence', url, open: false };
  }

  if (rights) {
    const r = rights.toLowerCase();
    if (r.includes('public domain')) return { label: 'Public Domain', open: true };
    if (r.includes('creative commons')) return { label: 'Creative Commons', open: true };
    return { label: rights.slice(0, 48), open: false };
  }

  // No explicit licence on record. Archive.org's feature-film collections are
  // curated public-domain/CC material and Archive itself offers a download
  // button on every item page, so we treat those as openly downloadable and
  // flag everything else for review rather than assuming permission.
  const collections = meta?.collection;
  const list = Array.isArray(collections) ? collections : collections ? [String(collections)] : [];
  if (list.some((c) => FILM_COLLECTIONS.includes(String(c)))) {
    return { label: 'Public Domain (Archive.org)', open: true };
  }
  return { label: 'Rights unverified', open: false };
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`archive.org responded ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildSearchUrl(
  query: string,
  opts: { rows: number; page: number; sort?: string }
): string {
  const params = new URLSearchParams();
  params.set('q', query);
  SEARCH_FIELDS.forEach((f) => params.append('fl[]', f));
  params.set('rows', String(opts.rows));
  params.set('page', String(opts.page));
  params.set('output', 'json');
  if (opts.sort) params.append('sort[]', opts.sort);
  return `${BASE}/advancedsearch.php?${params.toString()}`;
}

function docToItem(doc: ArchiveSearchDoc): SourceItem | null {
  if (!doc.identifier) return null;
  const title = stripHtml(first(doc.title)) || doc.identifier;
  const description = stripHtml(doc.description);
  const license = licenseInfo({
    licenseurl: doc.licenseurl,
    rights: doc.rights,
    collection: doc.collection,
  });
  const year = doc.year ? parseInt(String(doc.year), 10) : undefined;

  return {
    provider: 'archive',
    id: doc.identifier,
    title,
    year: year && year > 1800 && year < 2100 ? year : undefined,
    description: description ? description.slice(0, 600) : undefined,
    posterUrl: `${BASE}/services/img/${doc.identifier}`,
    backdropUrl: `${BASE}/services/img/${doc.identifier}`,
    durationSec: parseDuration(doc.runtime),
    kind: 'movie',
    license: license.label,
    licenseUrl: license.url,
    sourceUrl: `${BASE}/details/${doc.identifier}`,
    creator: stripHtml(first(doc.creator)),
    score: typeof doc.downloads === 'number' ? doc.downloads : undefined,
    meta: { downloads: doc.downloads, itemSize: doc.item_size, collection: doc.collection },
  };
}

// ── The provider ────────────────────────────────────────────────────────────

const capabilities: SourceCapabilities = {
  search: true,
  embed: true,
  directPlayback: true,
  series: true,
  subtitles: true,
  download: 'allowed',
  requiresKey: false,
  browserDirect: true,
};

/** Curated homepage rows: label + Archive query + sort. */
const CURATED: Array<{ key: string; title: string; subtitle?: string; q: string; sort: string }> = [
  {
    key: 'pd-classics',
    title: 'Public Domain Classics',
    subtitle: 'Free to watch and free to keep',
    q: `collection:feature_films AND mediatype:movies`,
    sort: 'downloads desc',
  },
  {
    key: 'scifi-horror',
    title: 'Sci-Fi & Horror',
    q: `(collection:SciFi_Horror OR subject:"science fiction" OR subject:horror) AND mediatype:movies`,
    sort: 'downloads desc',
  },
  {
    key: 'noir-western',
    title: 'Noir & Western',
    q: `(subject:"film noir" OR subject:western OR subject:"western film") AND mediatype:movies`,
    sort: 'downloads desc',
  },
  {
    key: 'animation',
    title: 'Animation & Cartoons',
    q: `(collection:animationandcartoons OR collection:classic_cartoons) AND mediatype:movies`,
    sort: 'downloads desc',
  },
  {
    key: 'prelinger',
    title: 'The Prelinger Archives',
    subtitle: 'Ephemeral film, adverts and industrial reels',
    q: `collection:prelinger AND mediatype:movies`,
    sort: 'downloads desc',
  },
  {
    key: 'fresh-films',
    title: 'Fresh on the Archive',
    q: `collection:feature_films AND mediatype:movies`,
    sort: 'publicdate desc',
  },
];

export const archiveSource: MediaSource = {
  id: 'archive',
  name: 'Internet Archive',
  shortName: 'Archive.org',
  description:
    'Public-domain and Creative Commons films from archive.org. Streams in-app and downloads to your device.',
  badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
  capabilities,
  attribution: 'Content courtesy of the Internet Archive (archive.org).',

  available() {
    return true;
  },

  async search(
    query: string,
    opts: SourceSearchOptions = {}
  ): Promise<SourceSearchResult> {
    const rows = Math.min(Math.max(opts.limit ?? 24, 1), 60);
    const page = opts.page ?? 1;
    const trimmed = query.trim();

    if (!trimmed) {
      return { provider: 'archive', query, items: [], page, totalResults: 0 };
    }

    // Two-pass search: prefer real films from the curated collections, then
    // widen to the whole moving-image catalogue if that came up short. This
    // keeps results cinematic without silently missing obscure titles.
    const scoped = `(${trimmed}) AND mediatype:movies AND (${FILM_COLLECTIONS.map(
      (c) => `collection:${c}`
    ).join(' OR ')})`;
    const broad = `(${trimmed}) AND mediatype:movies`;

    try {
      const first = await getJson<{
        response: { numFound: number; docs: ArchiveSearchDoc[] };
      }>(
        buildSearchUrl(opts.featureFilmsOnly === false ? broad : scoped, {
          rows,
          page,
          sort: 'downloads desc',
        }),
        opts.signal
      );

      let docs = first.response?.docs ?? [];
      let numFound = first.response?.numFound ?? docs.length;

      if (docs.length < Math.min(rows, 8) && opts.featureFilmsOnly !== false) {
        const wider = await getJson<{
          response: { numFound: number; docs: ArchiveSearchDoc[] };
        }>(buildSearchUrl(broad, { rows, page, sort: 'downloads desc' }), opts.signal);
        const extra = (wider.response?.docs ?? []).filter(
          (d) => !docs.some((existing) => existing.identifier === d.identifier)
        );
        docs = [...docs, ...extra].slice(0, rows);
        numFound = Math.max(numFound, wider.response?.numFound ?? 0);
      }

      const items = docs.map(docToItem).filter((i): i is SourceItem => Boolean(i));
      return {
        provider: 'archive',
        query,
        items,
        page,
        totalResults: numFound,
        totalPages: Math.ceil(numFound / rows),
      };
    } catch (err) {
      return {
        provider: 'archive',
        query,
        items: [],
        page,
        error: err instanceof Error ? err.message : 'archive.org search failed',
      };
    }
  },

  async resolve(id: string, opts?: { episodeId?: string }): Promise<Playable | null> {
    if (!id) return null;
    const meta = await getJson<ArchiveMetadata>(`${BASE}/metadata/${encodeURIComponent(id)}`);
    if (!meta || meta.isDark || !meta.files?.length) return null;

    const itemMeta = (meta.metadata || {}) as Record<string, unknown>;
    const license = licenseInfo(itemMeta);
    const title = stripHtml(first(itemMeta.title as string | string[])) || id;
    const videos = meta.files.filter(looksLikeVideo);
    const subtitles = meta.files.filter(isSubtitle);

    if (videos.length === 0) {
      // No browser-playable derivative — fall back to Archive's own player.
      return {
        provider: 'archive',
        id,
        kind: 'iframe',
        url: `${BASE}/embed/${encodeURIComponent(id)}`,
        title,
        posterUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
        license: license.label,
        licenseUrl: license.url,
        sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
        downloadTargets: license.open ? [] : undefined,
      };
    }

    const ranked = [...videos].sort((a, b) => rankFormat(b.format) - rankFormat(a.format));

    const toTarget = (file: ArchiveFile): DownloadTarget => ({
      url: `${BASE}/download/${encodeURIComponent(id)}/${encodeURI(file.name)}`,
      filename: file.name.replace(/[^\w.\-() ]+/g, '_'),
      sizeBytes: file.size ? parseInt(file.size, 10) : undefined,
      quality: qualityOf(file),
      mimeType: guessMime(file.name),
      durationSec: parseDuration(file.length),
    });

    const toDownloadTargets = (file: ArchiveFile): DownloadTarget[] => {
      if (!license.open) return [];
      const targets = [toTarget(file)];
      // Subtitles travel with the film when they exist.
      subtitles.slice(0, 4).forEach((s) => targets.push(toTarget(s)));
      return targets;
    };

    // Multi-file items are treated as a series: a full-season upload, a serial
    // or a multi-reel film. Single-file items play straight through.
    const isSeries =
      videos.length > 1 &&
      (() => {
        const collections = itemMeta.collection;
        const list = Array.isArray(collections)
          ? collections.map(String)
          : collections
            ? [String(collections)]
            : [];
        const hints = ['television', 'serial', 'series', 'sitcom', 'classic_cartoons'];
        return (
          list.some((c) => hints.some((h) => c.toLowerCase().includes(h))) ||
          videos.every((v) => /episode|\be\d{1,3}\b|part\s*\d/i.test(v.name))
        );
      })();

    if (isSeries) {
      const ordered = [...videos].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const episodes: SourceEpisode[] = ordered.map((file, index) => {
        const playable: Playable = {
          provider: 'archive',
          id,
          kind: 'video',
          url: `${BASE}/download/${encodeURIComponent(id)}/${encodeURI(file.name)}`,
          title: stripHtml(file.title) || `Episode ${index + 1}`,
          posterUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
          downloadTargets: toDownloadTargets(file),
          license: license.label,
          licenseUrl: license.url,
          sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
        };
        return {
          id: file.name,
          number: index + 1,
          title: stripHtml(file.title) || file.name.replace(/\.[^.]+$/, ''),
          durationSec: parseDuration(file.length),
          playable,
          downloadTargets: toDownloadTargets(file),
        };
      });

      const requested = opts?.episodeId
        ? episodes.find((e) => e.id === opts.episodeId)
        : undefined;

      return {
        provider: 'archive',
        id,
        kind: 'video',
        url: requested ? requested.playable.url : episodes[0].playable.url,
        title: requested ? `${title} — ${requested.title}` : title,
        posterUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
        episodes,
        downloadTargets: requested ? toDownloadTargets(videos[0]) : episodes.flatMap((e) => e.downloadTargets ?? []),
        license: license.label,
        licenseUrl: license.url,
        sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
      };
    }

    const best = ranked[0];
    // Offer every reasonable quality so the download sheet can let the user
    // pick a smaller file on mobile data.
    const alternatives = ranked
      .slice(0, 3)
      .map(toTarget)
      .filter((t, i, arr) => arr.findIndex((x) => x.url === t.url) === i);

    return {
      provider: 'archive',
      id,
      kind: 'video',
      url: `${BASE}/download/${encodeURIComponent(id)}/${encodeURI(best.name)}`,
      title,
      posterUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
      downloadTargets: license.open ? alternatives : [],
      license: license.label,
      licenseUrl: license.url,
      sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
      meta: {
        formats: ranked.map((f) => ({ name: f.name, format: f.format, quality: qualityOf(f) })),
        subtitleCount: subtitles.length,
      },
    } as Playable;
  },

  async describe(id: string): Promise<SourceItem | null> {
    if (!id) return null;
    try {
      const meta = await getJson<ArchiveMetadata>(
        `${BASE}/metadata/${encodeURIComponent(id)}`
      );
      if (!meta || meta.isDark) return null;
      const itemMeta = (meta.metadata || {}) as Record<string, unknown>;
      const license = licenseInfo(itemMeta);
      const videos = (meta.files || []).filter(looksLikeVideo);
      const runtime =
        parseDuration(first(itemMeta.runtime as string | string[])) ??
        videos.map((v) => parseDuration(v.length)).find((v) => v && v > 600);
      const yearRaw = String(itemMeta.year ?? itemMeta.date ?? '').slice(0, 4);
      const year = /^\d{4}$/.test(yearRaw) ? parseInt(yearRaw, 10) : undefined;
      const collections = itemMeta.collection;
      const collectionList = Array.isArray(collections)
        ? collections.map(String)
        : collections
          ? [String(collections)]
          : [];

      return {
        provider: 'archive',
        id,
        title: stripHtml(first(itemMeta.title as string | string[])) || id,
        year,
        description: stripHtml(itemMeta.description as string | string[])?.slice(0, 1200),
        posterUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
        backdropUrl: `${BASE}/services/img/${encodeURIComponent(id)}`,
        durationSec: runtime,
        kind: videos.length > 1 && collectionList.some((c) => /television|serial|series/i.test(c)) ? 'series' : 'movie',
        license: license.label,
        licenseUrl: license.url,
        sourceUrl: `${BASE}/details/${encodeURIComponent(id)}`,
        creator: stripHtml(first(itemMeta.creator as string | string[])),
        meta: {
          collection: collectionList,
          fileCount: videos.length,
          itemSize: meta.files?.reduce((sum, f) => sum + (parseInt(f.size || '0', 10) || 0), 0),
          downloads: itemMeta.downloads,
        },
      };
    } catch {
      return null;
    }
  },

  async curated(): Promise<CuratedRow[]> {
    const rows = await Promise.all(
      CURATED.map(async (row): Promise<CuratedRow> => {
        try {
          const res = await getJson<{
            response: { numFound: number; docs: ArchiveSearchDoc[] };
          }>(buildSearchUrl(row.q, { rows: 18, page: 1, sort: row.sort }));
          const items = (res.response?.docs ?? [])
            .map(docToItem)
            .filter((i): i is SourceItem => Boolean(i));
          return { key: row.key, title: row.title, subtitle: row.subtitle, items };
        } catch (err) {
          return {
            key: row.key,
            title: row.title,
            subtitle: row.subtitle,
            items: [],
            error: err instanceof Error ? err.message : 'row failed',
          };
        }
      })
    );
    // Never render an empty shelf.
    return rows.filter((r) => r.items.length > 0);
  },
};

export default archiveSource;
