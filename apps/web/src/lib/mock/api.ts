// Veyra Mock API Router
// Handles frontend API calls entirely in the browser using the mock DB,
// so every page works without the backend. Mirrors the exact response
// shapes the real Cloudflare Worker returns.

import {
  getDB,
  saveDB,
  resetDB,
  uid,
  slugify,
  attachGenres,
  withGenres,
  getMovieById,
  getMovieBySlug,
  type MockMovie,
  type MockUser,
  type MockSession,
} from './db';

// Demo playback stream (public test HLS asset) so the player works offline.
const DEMO_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

interface MockRequestOptions {
  method?: string;
  body?: any;
}

// A small delay so loading states are visible, matching real network latency.
function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseId(path: string): number | null {
  const match = path.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function currentSession(): MockSession | null {
  return getDB().session;
}

function requireSession(): MockSession {
  const session = getDB().session;
  if (session) return session;
  // Auto-sign-in as demo user when nothing is stored, so the app works
  // end-to-end without going through auth first.
  const demo = getDB().users.find((u) => u.id === 2) || getDB().users[0];
  const mockSession: MockSession = {
    accessToken: 'mock-access-token-demo',
    refreshToken: 'mock-refresh-token-demo',
    user: demo,
  };
  getDB().session = mockSession;
  saveDB();
  return mockSession;
}

function serializeMovie(movie: MockMovie) {
  return attachGenres(movie);
}

function publicUser(user: MockUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

function makeSession(user: MockUser): MockSession {
  return {
    accessToken: `mock-access-${user.id}-${Date.now()}`,
    refreshToken: `mock-refresh-${user.id}-${Date.now()}`,
    user,
  };
}

// ── Storage mock state ─────────────────────────────────────────────────────

const STORAGE_KEY = 'veyra-mock-storage-v1';

interface MockStorageState {
  files: Array<{ key: string; name: string; size: number; type: string; uploadedAt: string }>;
}

function getStorageState(): MockStorageState {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockStorageState;
    } catch {
      // ignore
    }
  }
  return { files: [] };
}

function saveStorageState(state: MockStorageState) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }
}

// ── Admin / audit helpers ──────────────────────────────────────────────────

function addAudit(action: string, target?: string, details?: string) {
  const db = getDB();
  const session = db.session;
  db.audit.unshift({
    id: uid(),
    userId: session?.user.id,
    username: session?.user.username || 'guest',
    action,
    target,
    details,
    createdAt: new Date().toISOString(),
  });
  saveDB();
}

// ── Router ─────────────────────────────────────────────────────────────────

export async function mockRequest(
  endpoint: string,
  options: MockRequestOptions = {}
): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const path = endpoint.split('?')[0];
  const query = new URLSearchParams(endpoint.split('?')[1] || '');
  const db = getDB();
  const session = requireSession();
  const userId = session.user.id;
  await delay(200);

  // ── Auth ────────────────────────────────────────────────────────────────
  // Firebase token exchange — maps the Firebase user (or demo user) to the
  // mock DB user so the app works end-to-end in demo mode.
  if (path === '/api/auth/firebase' && method === 'POST') {
    const { idToken } = options.body || {};
    // Best-effort email extraction from the JWT payload (demo mode only)
    let email = '';
    if (idToken && typeof idToken === 'string') {
      try {
        const payloadPart = idToken.split('.')[1];
        if (payloadPart) {
          const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
          email = decoded.email || '';
        }
      } catch {
        // ignore malformed tokens
      }
    }
    let user = email
      ? db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
      : undefined;
    if (!user) {
      user = db.users.find((u) => u.id === 2) || db.users[0];
    }
    const newSession = makeSession(user);
    db.session = newSession;
    saveDB();
    addAudit('auth.firebase', user.username);
    return { user: publicUser(user), isNewUser: false };
  }

  if (path === '/api/auth/me' && method === 'GET') {
    return { user: publicUser(session.user) };
  }

  // ── Movies ──────────────────────────────────────────────────────────────
  if (path === '/api/movies' && method === 'GET') {
    const page = parseInt(query.get('page') || '1', 10);
    const limit = parseInt(query.get('limit') || '20', 10);
    const genre = query.get('genre');
    const type = query.get('type');
    let movies = db.movies.filter((m) => m.status === 'published');
    if (genre) {
      const gid = parseInt(genre, 10);
      movies = movies.filter((m) => m.genreIds.includes(gid));
    }
    if (type) {
      movies = movies.filter((m) => m.type === type);
    }
    const total = movies.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = movies.slice(start, start + limit);
    return {
      movies: withGenres(paged),
      pagination: { page, limit, total, totalPages },
    };
  }

  if (path === '/api/movies/featured' && method === 'GET') {
    const movies = db.movies.filter((m) => m.status === 'published' && m.featured);
    return { movies: withGenres(movies) };
  }

  if (path === '/api/movies/trending' && method === 'GET') {
    const limit = parseInt(query.get('limit') || '10', 10);
    const movies = db.movies
      .filter((m) => m.status === 'published' && m.trending)
      .slice(0, limit);
    return { movies: withGenres(movies) };
  }

  const movieSlugMatch = path.match(/^\/api\/movies\/([^/]+)$/);
  if (movieSlugMatch && method === 'GET') {
    const movie = getMovieBySlug(decodeURIComponent(movieSlugMatch[1]));
    if (!movie) {
      const err = new Error('Movie not found') as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    return { movie: serializeMovie(movie) };
  }

  // ── Genres ──────────────────────────────────────────────────────────────
  if (path === '/api/genres' && method === 'GET') {
    return { genres: db.genres };
  }

  // ── Search ──────────────────────────────────────────────────────────────
  if (path === '/api/search' && method === 'GET') {
    const q = (query.get('q') || '').toLowerCase().trim();
    const page = parseInt(query.get('page') || '1', 10);
    const limit = parseInt(query.get('limit') || '20', 10);
    let results = db.movies.filter((m) => m.status === 'published');
    if (q) {
      results = results.filter((m) => {
        const haystack = [
          m.title,
          m.description,
          m.shortDescription,
          m.director,
          m.tags?.join(' '),
          m.cast?.join(' '),
          m.genres?.map((g) => g.name).join(' '),
          String(m.year || ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return {
      results: withGenres(results.slice(start, start + limit)),
      query: query.get('q') || '',
      pagination: { page, limit, total, totalPages },
    };
  }

  if (path === '/api/search/suggestions' && method === 'GET') {
    const q = (query.get('q') || '').toLowerCase().trim();
    let suggestions = db.movies.filter((m) => m.status === 'published');
    if (q) {
      suggestions = suggestions.filter((m) => m.title.toLowerCase().includes(q));
    }
    return { suggestions: withGenres(suggestions.slice(0, 8)) };
  }

  // ── Watch ───────────────────────────────────────────────────────────────
  if (path === '/api/watch/progress' && method === 'GET') {
    const progress = db.progress
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { progress };
  }

  if (path === '/api/watch/progress' && method === 'POST') {
    const { movieId, episodeId, position, duration } = options.body || {};
    const existing = db.progress.find(
      (p) =>
        p.userId === userId &&
        ((movieId && p.movieId === movieId) || (episodeId && p.episodeId === episodeId))
    );
    const completed = duration > 0 && position / duration > 0.92;
    if (existing) {
      existing.position = position;
      existing.duration = duration;
      existing.completed = completed;
      existing.updatedAt = new Date().toISOString();
    } else {
      db.progress.unshift({
        id: uid(),
        userId,
        movieId,
        episodeId,
        position,
        duration,
        completed,
        updatedAt: new Date().toISOString(),
      });
    }
    // Record history entry
    if (movieId) {
      const existingHistory = db.history.find(
        (h) => h.userId === userId && h.movieId === movieId
      );
      const pct = duration > 0 ? Math.round((position / duration) * 100) : 0;
      if (existingHistory) {
        existingHistory.watchedAt = new Date().toISOString();
        existingHistory.progress = pct;
      } else {
        db.history.unshift({ id: uid(), userId, movieId, watchedAt: new Date().toISOString(), progress: pct });
      }
    }
    saveDB();
    return { success: true };
  }

  if (path === '/api/watch/history' && method === 'GET') {
    const history = db.history
      .filter((h) => h.userId === userId)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
      .map((h) => {
        const movie = getMovieById(h.movieId);
        return {
          id: h.id,
          movieId: h.movieId,
          episodeId: h.episodeId,
          watchedAt: h.watchedAt,
          progress: h.progress,
          movie: movie ? serializeMovie(movie) : null,
        };
      });
    return { history };
  }

  const streamingMatch = path.match(/^\/api\/watch\/streaming-url\/(\d+)$/);
  if (streamingMatch && method === 'GET') {
    const id = parseInt(streamingMatch[1], 10);
    const movie = getMovieById(id);
    const quality = query.get('quality') || '1080';
    const available = movie?.availableQualities || ['480', '720', '1080'];
    const resolved = available.includes(quality) ? quality : available[available.length - 1];
    return {
      movieId: id,
      quality: resolved,
      streamingUrl: DEMO_HLS,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  if (path === '/api/watch/watchlist' && method === 'GET') {
    const watchlist = db.watchlist
      .filter((w) => w.userId === userId)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .map((w) => {
        const movie = getMovieById(w.movieId);
        return {
          id: w.id,
          addedAt: w.addedAt,
          movie: movie ? serializeMovie(movie) : null,
        };
      });
    return { watchlist };
  }

  if (path === '/api/watch/watchlist' && method === 'POST') {
    const { movieId } = options.body || {};
    if (!movieId || !getMovieById(movieId)) {
      throw new Error('Invalid movie');
    }
    if (!db.watchlist.some((w) => w.userId === userId && w.movieId === movieId)) {
      db.watchlist.push({ id: uid(), userId, movieId, addedAt: new Date().toISOString() });
      saveDB();
    }
    return { success: true };
  }

  const watchlistDeleteMatch = path.match(/^\/api\/watch\/watchlist\/(\d+)$/);
  if (watchlistDeleteMatch && method === 'DELETE') {
    const movieId = parseInt(watchlistDeleteMatch[1], 10);
    db.watchlist = db.watchlist.filter((w) => !(w.userId === userId && w.movieId === movieId));
    saveDB();
    return { success: true };
  }

  // ── Ratings ─────────────────────────────────────────────────────────────
  const ratingsMovieMatch = path.match(/^\/api\/ratings\/movie\/(\d+)$/);
  if (ratingsMovieMatch && method === 'GET') {
    const movieId = parseInt(ratingsMovieMatch[1], 10);
    const movieRatings = db.ratings
      .filter((r) => r.movieId === movieId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((r) => {
        const user = db.users.find((u) => u.id === r.userId);
        return {
          id: r.id,
          rating: r.rating,
          review: r.review,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          userId: r.userId,
          username: user?.username || 'unknown',
          displayName: user?.displayName || user?.username || 'Unknown',
          avatarUrl: user?.avatarUrl || '',
        };
      });
    const movieRatingEntries = db.ratings.filter((r) => r.movieId === movieId);
    const avgRating = movieRatingEntries.length > 0
      ? Math.round((movieRatingEntries.reduce((sum, r) => sum + r.rating, 0) / movieRatingEntries.length) * 10) / 10
      : 0;
    const userRatingEntry = db.ratings.find((r) => r.movieId === movieId && r.userId === userId);
    return {
      ratings: movieRatings,
      stats: { average: avgRating, total: movieRatingEntries.length },
      userRating: userRatingEntry ? { id: userRatingEntry.id, rating: userRatingEntry.rating, review: userRatingEntry.review } : null,
    };
  }

  if (path === '/api/ratings' && method === 'POST') {
    const { movieId, rating, review } = options.body || {};
    if (!movieId || !rating) {
      throw new Error('movieId and rating are required');
    }
    if (rating < 1 || rating > 10) {
      throw new Error('Rating must be between 1 and 10');
    }
    const existing = db.ratings.find((r) => r.movieId === movieId && r.userId === userId);
    if (existing) {
      existing.rating = rating;
      if (review !== undefined) existing.review = review;
      existing.updatedAt = new Date().toISOString();
      saveDB();
      return { success: true, updated: true };
    }
    db.ratings.push({
      id: uid(),
      userId,
      movieId,
      rating,
      review,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveDB();
    return { success: true, updated: false };
  }

  const ratingsDeleteMatch = path.match(/^\/api\/ratings\/(\d+)$/);
  if (ratingsDeleteMatch && method === 'DELETE') {
    const movieId = parseInt(ratingsDeleteMatch[1], 10);
    db.ratings = db.ratings.filter((r) => !(r.movieId === movieId && r.userId === userId));
    saveDB();
    return { success: true };
  }

  if (path === '/api/ratings/user' && method === 'GET') {
    const limit = parseInt(query.get('limit') || '50', 10);
    const userRatings = db.ratings
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((r) => {
        const movie = getMovieById(r.movieId);
        return {
          id: r.id,
          rating: r.rating,
          review: r.review,
          createdAt: r.createdAt,
          movie: movie
            ? { id: movie.id, title: movie.title, slug: movie.slug, posterUrl: movie.posterUrl, year: movie.year, type: movie.type }
            : null,
        };
      });
    return { ratings: userRatings };
  }

  // ── Admin ───────────────────────────────────────────────────────────────
  if (session.user.role !== 'admin' && path.startsWith('/api/admin/')) {
    const err = new Error('Forbidden: admin access required') as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  if (path === '/api/admin/dashboard' && method === 'GET') {
    const published = db.movies.filter((m) => m.status === 'published');
    const totalViews = db.movies.reduce((sum, m) => sum + (m.viewCount || 0), 0);
    const storageUsed = db.movies.length * 2147483648; // ~2GB per title
    return {
      stats: {
        totalMovies: db.movies.length,
        publishedMovies: published.length,
        totalUsers: db.users.length,
        totalViews,
        totalWatchTimeHours: Math.round(totalViews / 60),
        storageUsed,
        storageLimit: 10 * 1024 * 1024 * 1024,
        activeJobs: db.jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length,
      },
      recentActivity: db.audit.slice(0, 6),
      recentMovies: withGenres(db.movies.slice(0, 5)),
    };
  }

  if (path === '/api/admin/movies' && method === 'GET') {
    const page = parseInt(query.get('page') || '1', 10);
    const limit = parseInt(query.get('limit') || '50', 10);
    const movies = [...db.movies].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const start = (page - 1) * limit;
    return {
      movies: withGenres(movies.slice(start, start + limit)),
      pagination: { page, limit, total: movies.length, totalPages: Math.ceil(movies.length / limit) },
    };
  }

  if (path === '/api/admin/movies' && method === 'POST') {
    const body = options.body || {};
    const title = body.title?.trim();
    if (!title) throw new Error('Title is required');
    const now = new Date().toISOString();
    const movie: MockMovie = {
      id: uid(),
      title,
      slug: body.slug || slugify(title),
      description: body.description || '',
      shortDescription: body.shortDescription || '',
      type: body.type || 'movie',
      year: body.year || new Date().getFullYear(),
      duration: body.duration || null,
      rating: body.rating || 'PG-13',
      imdbRating: body.imdbRating || null,
      director: body.director || '',
      cast: body.cast || [],
      tags: body.tags || [],
      posterUrl: body.posterUrl || `https://picsum.photos/seed/${slugify(title)}/400/600`,
      backdropUrl: body.backdropUrl || `https://picsum.photos/seed/${slugify(title)}b/1280/720`,
      trailerUrl: body.trailerUrl || '',
      status: body.status || 'draft',
      featured: body.featured || false,
      trending: body.trending || false,
      viewCount: 0,
      availableQualities: body.availableQualities || ['480', '720', '1080'],
      genreIds: body.genreIds || [],
      createdAt: now,
      updatedAt: now,
    };
    db.movies.push(movie);
    saveDB();
    addAudit('movie.create', title);
    return { movie: serializeMovie(movie) };
  }

  const adminMovieMatch = path.match(/^\/api\/admin\/movies\/(\d+)$/);
  if (adminMovieMatch) {
    const id = parseInt(adminMovieMatch[1], 10);
    const movie = getMovieById(id);
    if (!movie) throw new Error('Movie not found');

    if (method === 'PUT') {
      const body = options.body || {};
      const prevTitle = movie.title;
      Object.assign(movie, body);
      movie.updatedAt = new Date().toISOString();
      if (body.genreIds) {
        movie.genreIds = body.genreIds;
      }
      saveDB();
      addAudit('movie.update', prevTitle);
      return { movie: serializeMovie(movie) };
    }

    if (method === 'DELETE') {
      db.movies = db.movies.filter((m) => m.id !== id);
      saveDB();
      addAudit('movie.delete', movie.title);
      return { success: true };
    }
  }

  const episodesMatch = path.match(/^\/api\/admin\/movies\/(\d+)\/episodes$/);
  if (episodesMatch && method === 'POST') {
    const movie = getMovieById(parseInt(episodesMatch[1], 10));
    if (!movie) throw new Error('Movie not found');
    addAudit('movie.episode', movie.title);
    return { success: true, episodeId: uid() };
  }

  if (path === '/api/admin/users' && method === 'GET') {
    return {
      users: db.users.map((u) => ({
        ...publicUser(u),
        moviesWatched: db.history.filter((h) => h.userId === u.id).length,
        watchlistCount: db.watchlist.filter((w) => w.userId === u.id).length,
        joinedAt: u.createdAt,
      })),
    };
  }

  if (path === '/api/admin/audit' && method === 'GET') {
    return { logs: db.audit };
  }

  if (path === '/api/admin/jobs' && method === 'GET') {
    return { jobs: db.jobs };
  }

  // ── Storage (mock) ───────────────────────────────────────────────────────
  const storageState = getStorageState();

  if (path === '/api/storage/providers' && method === 'GET') {
    const providers = [
      {
        type: 'cloudflare-r2',
        name: 'Cloudflare R2',
        description: 'Fast, S3-compatible object storage with zero egress fees.',
        authType: 'built-in',
        capabilities: { upload: true, download: true, streaming: true, directLinks: true, thumbnails: true, delete: true, folders: true, multipartUpload: true },
        connected: true,
      },
      {
        type: 'terabox',
        name: 'TeraBox',
        description: 'Large media storage with M3U8 streaming support.',
        authType: 'oauth',
        capabilities: { upload: true, download: true, streaming: true, directLinks: false, thumbnails: false, delete: true, folders: true, multipartUpload: true },
      },
      {
        type: 'backblaze-b2',
        name: 'Backblaze B2',
        description: 'S3-compatible object storage for backups and archives.',
        authType: 'credentials',
        capabilities: { upload: true, download: true, streaming: true, directLinks: true, thumbnails: true, delete: true, folders: false, multipartUpload: true },
      },
      {
        type: 'google-drive',
        name: 'Google Drive',
        description: 'Archive and asset storage with OAuth integration.',
        authType: 'oauth',
        capabilities: { upload: true, download: true, streaming: false, directLinks: true, thumbnails: true, delete: true, folders: true, multipartUpload: true },
      },
      {
        type: 'dropbox',
        name: 'Dropbox',
        description: 'Cloud storage with OAuth integration.',
        authType: 'oauth',
        capabilities: { upload: true, download: true, streaming: false, directLinks: true, thumbnails: true, delete: true, folders: true, multipartUpload: true },
      },
    ];
    const accounts = [
      {
        id: 'r2-default',
        providerType: 'cloudflare-r2',
        displayName: 'Cloudflare R2',
        status: 'connected',
        purpose: 'primary-media',
        priority: 10,
        isDefault: true,
        quotaTotal: 10 * 1024 * 1024 * 1024,
        quotaUsed: 8.4 * 1024 * 1024 * 1024,
        lastHealthCheck: new Date().toISOString(),
        capabilities: null,
      },
    ];
    return { providers, accounts };
  }

  if (path === '/api/storage/accounts' && method === 'GET') {
    return {
      accounts: [
        {
          id: 'r2-default',
          providerType: 'cloudflare-r2',
          displayName: 'Cloudflare R2',
          status: 'connected',
          purpose: 'primary-media',
          priority: 10,
          isDefault: true,
          quotaTotal: 10 * 1024 * 1024 * 1024,
          quotaUsed: 8.4 * 1024 * 1024 * 1024,
          lastHealthCheck: new Date().toISOString(),
          capabilities: null,
        },
      ],
    };
  }

  if (path === '/api/storage/quota' && method === 'GET') {
    const totalSize = storageState.files.reduce((sum, f) => sum + f.size, 0);
    const used = 8.4 * 1024 * 1024 * 1024 + totalSize;
    const total = 10 * 1024 * 1024 * 1024;
    const fmt = (bytes: number) => {
      if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / 1024).toFixed(0)} KB`;
    };
    return {
      r2: {
        used,
        available: total - used,
        total,
        percentage: Math.round((used / total) * 100),
        usedFormatted: fmt(used),
        availableFormatted: fmt(total - used),
        totalFormatted: fmt(total),
      },
      files: {
        count: storageState.files.length + 24,
        totalSize: used,
      },
    };
  }

  if (path === '/api/storage/upload/movie' || path === '/api/storage/upload/episode' || path === '/api/storage/upload/image') {
    // FormData is passed; we just simulate a stored object and return a URL.
    const name = options.body?.get?.('file')?.name || 'upload.bin';
    const size = options.body?.get?.('file')?.size || 0;
    const type = options.body?.get?.('type') || 'original';
    const key = `mock/${Date.now()}-${name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    storageState.files.unshift({ key, name, size, type, uploadedAt: new Date().toISOString() });
    saveStorageState(storageState);
    addAudit('storage.upload', name);
    const ext = name.includes('.') ? name.split('.').pop() : 'bin';
    return {
      url: `https://picsum.photos/seed/${key.replace(/[^a-zA-Z0-9]/g, '')}/1280/720?ext=${ext}`,
      key,
    };
  }

  if (path === '/api/storage/list' && method === 'GET') {
    return { files: storageState.files, total: storageState.files.length };
  }

  const downloadMatch = path.match(/^\/api\/storage\/download\/(.+)$/);
  if (downloadMatch && method === 'GET') {
    return { url: `https://picsum.photos/seed/${downloadMatch[1]}/1280/720`, key: downloadMatch[1], expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }

  const deleteMatch = path.match(/^\/api\/storage\/(.+)$/);
  if (deleteMatch && method === 'DELETE') {
    storageState.files = storageState.files.filter((f) => f.key !== deleteMatch[1]);
    saveStorageState(storageState);
    return { success: true };
  }

  // ── Storage Accounts CRUD ───────────────────────────────────────────────
  if (path === '/api/storage/accounts' && method === 'POST') {
    const body = options.body || {};
    const newAccount = {
      id: `${body.providerType}-${Date.now()}`,
      providerType: body.providerType,
      displayName: body.displayName || body.providerType,
      status: 'connected',
      purpose: body.purpose || 'general',
      priority: body.priority || 5,
      isDefault: false,
      quotaTotal: null,
      quotaUsed: null,
      lastHealthCheck: new Date().toISOString(),
      capabilities: null,
    };
    return { account: newAccount };
  }

  const accountsPutMatch = path.match(/^\/api\/storage\/accounts\/([^/]+)$/);
  if (accountsPutMatch && method === 'PUT') {
    return { account: { id: accountsPutMatch[1], ...options.body, updatedAt: new Date().toISOString() } };
  }

  if (accountsPutMatch && method === 'DELETE') {
    return { success: true };
  }

  const accountsTestMatch = path.match(/^\/api\/storage\/accounts\/([^/]+)\/test$/);
  if (accountsTestMatch && method === 'POST') {
    return { health: { status: 'connected', message: 'Connection OK', lastChecked: new Date().toISOString(), latencyMs: 34 + Math.floor(Math.random() * 20) } };
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  const err = new Error(`Mock API: no handler for ${method} ${path}`) as Error & { status?: number };
  err.status = 404;
  throw err;
}

// Explicit demo-mode controls (used by dev tools / settings)
export function mockLoginAs(userId: number) {
  const user = getDB().users.find((u) => u.id === userId) || getDB().users[0];
  getDB().session = makeSession(user);
  saveDB();
  return user;
}

export function mockLogout() {
  getDB().session = null;
  saveDB();
}

export function mockResetAll() {
  resetDB();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
