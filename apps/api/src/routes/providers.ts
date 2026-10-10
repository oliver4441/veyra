import { Hono } from 'hono';
import type { Env } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Source provider proxy (optional)
// ─────────────────────────────────────────────────────────────────────────────
// The browser talks to archive.org directly by default — those JSON APIs are
// CORS-enabled, so the app works with no backend at all. This route exists for
// deployments that want:
//
//   • edge caching of provider responses (Cloudflare Cache API)
//   • one IP hitting the provider instead of every visitor's
//   • the YouTube Data API key kept secret (the browser never sees it)
//
// Responses are passed through raw. Normalisation lives in the client
// (lib/sources/*) so there is exactly one implementation of it.
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVE_BASE = 'https://archive.org';
const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';

const ARCHIVE_SEARCH_FIELDS = [
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

const providers = new Hono<{ Bindings: Env }>();

/** Cache a provider response at the edge. TTLs are deliberately conservative. */
async function cached(
  c: any,
  key: string,
  ttlSeconds: number,
  producer: () => Promise<{ body: unknown; status?: number }>
) {
  const cache = caches.default;
  const cacheKey = new Request(`https://veyra-providers.cache/${key}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const payload = (await hit.json()) as { raw: unknown };
    return c.json({ raw: payload.raw, cached: true });
  }

  const { body, status } = await producer();
  if (status && status >= 400) {
    return c.json({ error: 'Provider request failed', status }, status as 400);
  }

  // Store a copy at the edge, then answer with the cache marker added.
  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ raw: body }), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  return c.json({ raw: body, cached: false });
}

// ── Capability report ───────────────────────────────────────────────────────

providers.get('/', (c) => {
  const youtubeConfigured = Boolean(c.env.YOUTUBE_API_KEY);
  return c.json({
    providers: [
      {
        id: 'archive',
        name: 'Internet Archive',
        enabled: true,
        capabilities: {
          search: true,
          embed: true,
          directPlayback: true,
          series: true,
          // Public-domain and Creative Commons items may be saved locally.
          download: 'allowed',
        },
        proxy: `${ARCHIVE_BASE}/advancedsearch.php`,
      },
      {
        id: 'youtube',
        name: 'YouTube',
        enabled: youtubeConfigured,
        capabilities: {
          search: youtubeConfigured,
          embed: true,
          directPlayback: false,
          series: true,
          // YouTube's terms do not permit downloading outside their own app.
          download: 'blocked',
        },
      },
      {
        id: 'external',
        name: 'Other free platforms',
        enabled: Boolean(c.env.TMDB_API_READ_ACCESS_TOKEN),
        capabilities: {
          search: false,
          embed: false,
          directPlayback: false,
          series: true,
          download: 'blocked',
        },
        note: 'Surfaced through TMDB watch providers as deep links only.',
      },
    ],
  });
});

// ── Internet Archive ────────────────────────────────────────────────────────

providers.get('/archive/search', async (c) => {
  const query = (c.req.query('q') || '').trim();
  if (!query) return c.json({ error: 'q is required' }, 400);

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const rows = Math.min(60, Math.max(1, parseInt(c.req.query('rows') || '24', 10)));
  const sort = c.req.query('sort') || 'downloads desc';

  const params = new URLSearchParams();
  params.set('q', query);
  ARCHIVE_SEARCH_FIELDS.forEach((field) => params.append('fl[]', field));
  params.set('rows', String(rows));
  params.set('page', String(page));
  params.set('output', 'json');
  params.append('sort[]', sort);

  const url = `${ARCHIVE_BASE}/advancedsearch.php?${params.toString()}`;
  const key = `archive/search/${encodeURIComponent(url)}`;

  return cached(c, key, 3600, async () => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Veyra/1.0 (+https://github.com/oliver4441/veyra)',
      },
      cf: { cacheTtl: 3600, cacheEverything: true } as never,
    });
    return { body: await response.json(), status: response.status };
  });
});

providers.get('/archive/:id/metadata', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const url = `${ARCHIVE_BASE}/metadata/${encodeURIComponent(id)}`;
  const key = `archive/metadata/${encodeURIComponent(id)}`;

  return cached(c, key, 21600, async () => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Veyra/1.0 (+https://github.com/oliver4441/veyra)',
      },
    });
    return { body: await response.json(), status: response.status };
  });
});

// ── YouTube (keeps the Data API key server-side) ────────────────────────────

function youtubeGuard(c: any) {
  if (!c.env.YOUTUBE_API_KEY) {
    return c.json(
      { error: 'YouTube is not configured on this deployment (YOUTUBE_API_KEY missing)' },
      503
    );
  }
  return null;
}

providers.get('/youtube/search', async (c) => {
  const blocked = youtubeGuard(c);
  if (blocked) return blocked;
  const apiKey = c.env.YOUTUBE_API_KEY as string;

  const query = (c.req.query('q') || '').trim();
  if (!query) return c.json({ error: 'q is required' }, 400);

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    // Only videos that allow embedding — otherwise the player shows a dead frame.
    videoEmbeddable: 'true',
    maxResults: String(Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '12', 10)))),
    safeSearch: 'moderate',
    key: apiKey,
  });
  if (c.req.query('pageToken')) params.set('pageToken', c.req.query('pageToken') as string);

  // Search responses are not cached: 100 quota units each, and results move.
  const response = await fetch(`${YOUTUBE_BASE}/search?${params.toString()}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return c.json({ error: 'YouTube search failed', status: response.status, detail }, 502);
  }
  return c.json({ raw: await response.json(), cached: false });
});

providers.get('/youtube/videos', async (c) => {
  const blocked = youtubeGuard(c);
  if (blocked) return blocked;
  const apiKey = c.env.YOUTUBE_API_KEY as string;

  const ids = (c.req.query('ids') || '').trim();
  if (!ids) return c.json({ error: 'ids is required' }, 400);

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: ids.split(',').slice(0, 50).join(','),
    key: apiKey,
  });

  const key = `youtube/videos/${encodeURIComponent(params.get('id') || '')}`;
  return cached(c, key, 21600, async () => {
    const response = await fetch(`${YOUTUBE_BASE}/videos?${params.toString()}`);
    return { body: await response.json(), status: response.status };
  });
});

providers.get('/youtube/playlist', async (c) => {
  const blocked = youtubeGuard(c);
  if (blocked) return blocked;
  const apiKey = c.env.YOUTUBE_API_KEY as string;

  const playlistId = (c.req.query('id') || '').trim();
  if (!playlistId) return c.json({ error: 'id is required' }, 400);

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '18', 10)))),
    key: apiKey,
  });

  const key = `youtube/playlist/${encodeURIComponent(playlistId)}`;
  return cached(c, key, 43200, async () => {
    const response = await fetch(`${YOUTUBE_BASE}/playlistItems?${params.toString()}`);
    return { body: await response.json(), status: response.status };
  });
});

export { providers as providerRoutes };
