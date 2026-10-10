import { Hono } from 'hono';
import { eq, desc, sql, and, asc } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { getTMDB, TMDBService } from '../lib/tmdb';
import {
  movies,
  series,
  seasons,
  episodes,
  genres,
  movieGenres,
  mediaFiles,
  mediaSources,
  users,
  auditLogs,
} from '../db/schema';
import { safeEqual } from '../lib/users';
import type { AppContext } from '../index';

const admin = new Hono<AppContext>();

/**
 * Endpoints reachable before the caller has proven anything.
 * `unlock` validates the operator key itself; `status` reports whether the
 * caller is an admin so the dashboard can decide to show the lock screen.
 */
const OPEN_ADMIN_PATHS = ['/api/admin/unlock', '/api/admin/status'];

// Brute-force protection for key guessing (per-isolate, like the rest of the
// rate limiting in this Worker).
const unlockAttempts = new Map<string, number[]>();

function unlockRateLimited(c: any, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('x-forwarded-for')?.split(',')[0] ||
    'unknown';
  const attempts = (unlockAttempts.get(ip) || []).filter((t) => now - t < windowMs);
  attempts.push(now);
  unlockAttempts.set(ip, attempts);
  return attempts.length > limit;
}

// Middleware to check admin role (userRole is resolved in index.ts from a
// Firebase token, the admin key, or an anonymous device id)
admin.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (OPEN_ADMIN_PATHS.includes(path)) {
    return next();
  }
  const role = c.get('userRole');
  if (!role || (role !== 'admin' && role !== 'superadmin')) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
});

// ── Key unlock ──────────────────────────────────────────────────────────────
// Veyra removed sign-up and sign-in, but the admin dashboard can delete
// catalogue entries and issue upload URLs, so it stays locked behind an
// operator key. The key is compared server-side and never stored.

// POST /api/admin/unlock  { key }
admin.post('/unlock', async (c) => {
  const configured = c.env.ADMIN_ACCESS_KEY;
  if (!configured) {
    // Fail closed: without a configured key nobody gets in, and the message
    // tells the operator exactly what to set.
    return c.json(
      {
        success: false,
        error:
          'Admin access is disabled on this deployment. Set the ADMIN_ACCESS_KEY secret to enable it.',
      },
      503
    );
  }

  if (unlockRateLimited(c)) {
    return c.json({ success: false, error: 'Too many attempts. Try again in a minute.' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const key = typeof body?.key === 'string' ? body.key.trim() : '';

  if (!key || !safeEqual(key, configured)) {
    try {
      const db = getDb(c.env.DATABASE_URL);
      await db.insert(auditLogs).values({
        userId: c.get('userId') || null,
        action: 'admin.unlock.denied',
        entityType: 'admin',
        ipAddress: c.req.header('CF-Connecting-IP') || null,
      });
    } catch {
      // Audit logging must never break the response path.
    }
    return c.json({ success: false, error: 'That key was rejected.' }, 403);
  }

  // The client now holds the key and sends it as X-Veyra-Admin-Key; identity is
  // resolved per request, so there is no session to mint here.
  return c.json({ success: true, mode: 'api' });
});

// GET /api/admin/status — is this caller an admin?
admin.get('/status', (c) => {
  const role = c.get('userRole');
  const kind = c.get('authKind');
  return c.json({
    admin: role === 'admin' || role === 'superadmin',
    role: role || null,
    mode: kind === 'admin-key' ? 'api' : kind === 'firebase' ? 'firebase' : null,
    guestMode: (c.env.GUEST_MODE || 'true').toLowerCase() !== 'false',
    adminKeyConfigured: Boolean(c.env.ADMIN_ACCESS_KEY),
  });
});

// GET /api/admin/dashboard - Dashboard stats
admin.get('/dashboard', async (c) => {
  const db = getDb(c.env.DATABASE_URL);

  const [movieCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies);

  const [seriesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(series);

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const [publishedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(eq(movies.status, 'published'));

  const [draftCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(eq(movies.status, 'draft'));

  const totalViews = await db
    .select({ total: sql<number>`coalesce(sum(${movies.viewCount}), 0)` })
    .from(movies);

  return c.json({
    stats: {
      totalMovies: movieCount.count,
      totalSeries: seriesCount.count,
      totalUsers: userCount.count,
      published: publishedCount.count,
      drafts: draftCount.count,
      totalViews: totalViews[0]?.total || 0,
    },
  });
});

// GET /api/admin/movies - List all movies (including drafts)
admin.get('/movies', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  const status = c.req.query('status');

  const where = status ? eq(movies.status, status as any) : undefined;

  const results = await db
    .select()
    .from(movies)
    .where(where)
    .orderBy(desc(movies.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies);

  return c.json({
    movies: results,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  });
});

// POST /api/admin/movies - Create a new movie
admin.post('/movies', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const body = await c.req.json();

  const {
    title,
    description,
    shortDescription,
    type,
    year,
    duration,
    rating,
    imdbRating,
    director,
    cast,
    tags,
    posterUrl,
    backdropUrl,
    trailerUrl,
    genreIds,
    availableQualities,
  } = body;

  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Check if slug exists
  const [existing] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.slug, slug))
    .limit(1);

  if (existing) {
    return c.json({ error: 'A movie with a similar title already exists' }, 409);
  }

  // Create movie
  const [newMovie] = await db
    .insert(movies)
    .values({
      title,
      slug,
      description,
      shortDescription,
      type: type || 'movie',
      year,
      duration,
      rating,
      imdbRating,
      director,
      cast,
      tags,
      posterUrl,
      backdropUrl,
      trailerUrl,
      availableQualities: availableQualities || ['480', '720', '1080'],
      status: 'draft',
    })
    .returning();

  // Add genres
  if (genreIds && genreIds.length > 0) {
    await db.insert(movieGenres).values(
      genreIds.map((genreId: number) => ({
        movieId: newMovie.id,
        genreId,
      }))
    );
  }

  // Create series record if type is series
  if (type === 'series') {
    await db.insert(series).values({
      movieId: newMovie.id,
    });
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: 'create',
    entityType: 'movie',
    entityId: newMovie.id,
    details: { title },
  });

  return c.json({ movie: newMovie }, 201);
});

// PUT /api/admin/movies/:id - Update a movie
admin.put('/movies/:id', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('id'));
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  // Update movie
  const [updated] = await db
    .update(movies)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(movies.id, movieId))
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: 'update',
    entityType: 'movie',
    entityId: movieId,
    details: { changes: Object.keys(body) },
  });

  return c.json({ movie: updated });
});

// DELETE /api/admin/movies/:id - Delete a movie
admin.delete('/movies/:id', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('id'));

  const [existing] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  // Audit log before deletion
  await db.insert(auditLogs).values({
    userId,
    action: 'delete',
    entityType: 'movie',
    entityId: movieId,
    details: { title: existing.title },
  });

  // Delete movie (cascade will handle related records)
  await db.delete(movies).where(eq(movies.id, movieId));

  return c.json({ success: true });
});

// POST /api/admin/movies/:id/episodes - Add episode to a series
admin.post('/movies/:id/episodes', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('id'));
  const body = await c.req.json();

  const { seasonNumber, episodeNumber, title, description, duration } = body;

  // Get series
  const [seriesData] = await db
    .select()
    .from(series)
    .where(eq(series.movieId, movieId))
    .limit(1);

  if (!seriesData) {
    return c.json({ error: 'Series not found' }, 404);
  }

  // Get or create season
  let [season] = await db
    .select()
    .from(seasons)
    .where(
      sql`${seasons.seriesId} = ${seriesData.id} AND ${seasons.seasonNumber} = ${seasonNumber}`
    )
    .limit(1);

  if (!season) {
    [season] = await db
      .insert(seasons)
      .values({
        seriesId: seriesData.id,
        seasonNumber,
      })
      .returning();
  }

  // Create episode
  const [newEpisode] = await db
    .insert(episodes)
    .values({
      seasonId: season.id,
      episodeNumber,
      title,
      description,
      duration,
    })
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: 'create',
    entityType: 'episode',
    entityId: newEpisode.id,
    details: { movieId, seasonNumber, episodeNumber, title },
  });

  return c.json({ episode: newEpisode }, 201);
});

// GET /api/admin/audit - Get audit logs
admin.get('/audit', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ logs });
});

// GET /api/admin/users - List users
admin.get('/users', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  return c.json({
    users: userList,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  });
});

// ── TMDB Admin Endpoints ────────────────────────────────────────────

// POST /api/admin/tmdb/search - Search TMDB for import
admin.post('/tmdb/search', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const body = await c.req.json();
  const { query, mediaType = 'multi', page = 1 } = body;

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Search query is required' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    let results;

    if (mediaType === 'movie') {
      const res = await tmdb.searchMovies(query, page);
      results = res.results.map((item) => ({
        tmdbId: item.id,
        mediaType: 'movie',
        title: item.title,
        originalTitle: item.original_title,
        overview: item.overview,
        releaseDate: item.release_date,
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
        originalLanguage: item.original_language,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        posterUrl: TMDBService.posterUrl(item.poster_path, 'lg'),
        backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'lg'),
      }));
    } else if (mediaType === 'tv') {
      const res = await tmdb.searchTV(query, page);
      results = res.results.map((item) => ({
        tmdbId: item.id,
        mediaType: 'tv',
        title: item.name,
        originalTitle: item.original_name,
        overview: item.overview,
        releaseDate: item.first_air_date,
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
        originalLanguage: item.original_language,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        posterUrl: TMDBService.posterUrl(item.poster_path, 'lg'),
        backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'lg'),
      }));
    } else {
      const res = await tmdb.searchMulti(query, page);
      results = res.results.map((item) => ({
        tmdbId: item.id,
        mediaType: item.media_type,
        title: item.title || item.name || '',
        originalTitle: item.original_title || item.original_name || '',
        overview: item.overview,
        releaseDate: item.release_date || item.first_air_date || '',
        voteAverage: item.vote_average,
        voteCount: item.vote_count,
        originalLanguage: item.original_language,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        posterUrl: TMDBService.posterUrl(item.poster_path, 'lg'),
        backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'lg'),
      }));
    }

    return c.json({
      results,
      query,
      page,
    });
  } catch (error: any) {
    console.error('TMDB search error:', error);
    return c.json({ error: 'TMDB search failed', details: error.message }, 502);
  }
});

// POST /api/admin/tmdb/import - Import TMDB metadata into Veyra
admin.post('/tmdb/import', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const userId = c.get('userId');
  const body = await c.req.json();
  const { tmdbId, mediaType } = body;

  if (!tmdbId || !mediaType) {
    return c.json({ error: 'tmdbId and mediaType are required' }, 400);
  }

  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return c.json({ error: 'mediaType must be "movie" or "tv"' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    const db = getDb(c.env.DATABASE_URL);

    // Check for existing import (prevent duplicates)
    const [existing] = await db
      .select({ id: movies.id, title: movies.title })
      .from(movies)
      .where(and(eq(movies.tmdbId, tmdbId), eq(movies.tmdbMediaType, mediaType)))
      .limit(1);

    if (existing) {
      return c.json({
        error: 'Already imported',
        existingMovieId: existing.id,
        existingTitle: existing.title,
      }, 409);
    }

    // Fetch TMDB details
    let tmdbData: any;
    if (mediaType === 'movie') {
      tmdbData = await tmdb.getMovieDetails(tmdbId);
    } else {
      tmdbData = await tmdb.getTVDetails(tmdbId);
    }

    // Normalize data
    const title = tmdbData.title || tmdbData.name;
    const originalTitle = tmdbData.original_title || tmdbData.original_name;
    const releaseDate = tmdbData.release_date || tmdbData.first_air_date || '';
    const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check slug uniqueness
    const [slugExists] = await db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.slug, slug))
      .limit(1);

    const finalSlug = slugExists ? `${slug}-${Date.now()}` : slug;

    // Get trailer
    let trailerUrl = null;
    if (tmdbData.videos?.results) {
      const trailer = tmdbData.videos.results.find(
        (v: any) => v.site === 'YouTube' && v.type === 'Trailer'
      );
      if (trailer) {
        trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }
    }

    // Get director
    let director = null;
    if (tmdbData.credits?.crew) {
      const dir = tmdbData.credits.crew.find((c: any) => c.job === 'Director');
      director = dir?.name || null;
    }

    // Get cast
    const castNames = tmdbData.credits?.cast?.slice(0, 15).map((c: any) => c.name) || [];

    // Create the movie entry
    const movieType = mediaType === 'tv' ? 'series' : 'movie';

    const [newMovie] = await db
      .insert(movies)
      .values({
        title,
        slug: finalSlug,
        description: tmdbData.overview,
        shortDescription: tmdbData.overview?.substring(0, 300),
        type: movieType as any,
        year,
        duration: tmdbData.runtime ? tmdbData.runtime * 60 : null,
        rating: null, // TMDB doesn't have MPAA ratings
        imdbRating: tmdbData.vote_average || null,
        director,
        cast: castNames,
        tags: tmdbData.genres?.map((g: any) => g.name) || [],
        posterUrl: TMDBService.posterUrl(tmdbData.poster_path, 'lg'),
        backdropUrl: TMDBService.backdropUrl(tmdbData.backdrop_path, 'lg'),
        trailerUrl,
        status: 'draft',
        // TMDB fields
        tmdbId: tmdbData.id,
        tmdbMediaType: mediaType,
        originalTitle,
        originalLanguage: tmdbData.original_language,
        overview: tmdbData.overview,
        releaseDate,
        voteAverage: tmdbData.vote_average,
        voteCount: tmdbData.vote_count,
        popularity: tmdbData.popularity,
        posterPath: tmdbData.poster_path,
        backdropPath: tmdbData.backdrop_path,
        genres: tmdbData.genres?.map((g: any) => g.name) || [],
        productionCountries: tmdbData.production_countries?.map((c: any) => c.name) || [],
        spokenLanguages: tmdbData.spoken_languages?.map((l: any) => l.english_name || l.name) || [],
        statusTmdb: tmdbData.status,
        metadataUpdatedAt: new Date(),
      })
      .returning();

    // Add genres to the genre linking table
    if (tmdbData.genres?.length > 0) {
      for (const tmdbGenre of tmdbData.genres) {
        // Find or create genre in Veyra
        const genreSlug = tmdbGenre.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let [existingGenre] = await db
          .select()
          .from(genres)
          .where(eq(genres.slug, genreSlug))
          .limit(1);

        if (!existingGenre) {
          [existingGenre] = await db
            .insert(genres)
            .values({ name: tmdbGenre.name, slug: genreSlug })
            .returning();
        }

        await db.insert(movieGenres).values({
          movieId: newMovie.id,
          genreId: existingGenre.id,
        });
      }
    }

    // Create series record if TV
    if (mediaType === 'tv') {
      const [newSeries] = await db
        .insert(series)
        .values({
          movieId: newMovie.id,
          totalSeasons: tmdbData.number_of_seasons || 1,
          totalEpisodes: tmdbData.number_of_episodes || 0,
          status: tmdbData.status === 'Returning Series' ? 'ongoing' : 'completed',
        })
        .returning();

      // Create season records
      if (tmdbData.seasons?.length > 0) {
        for (const tmdbSeason of tmdbData.seasons) {
          if (tmdbSeason.season_number === 0) continue; // Skip specials
          await db.insert(seasons).values({
            seriesId: newSeries.id,
            seasonNumber: tmdbSeason.season_number,
            title: tmdbSeason.name,
            description: tmdbSeason.overview,
            posterUrl: TMDBService.posterUrl(tmdbSeason.poster_path, 'md'),
            year: tmdbSeason.air_date ? parseInt(tmdbSeason.air_date.split('-')[0]) : null,
          });
        }
      }
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId,
      action: 'tmdb_import',
      entityType: 'movie',
      entityId: newMovie.id,
      details: {
        tmdbId,
        mediaType,
        title,
        source: 'tmdb',
      },
    });

    return c.json({
      movie: newMovie,
      tmdbId: tmdbData.id,
      mediaType,
      imported: true,
    }, 201);
  } catch (error: any) {
    console.error('TMDB import error:', error);
    return c.json({ error: 'TMDB import failed', details: error.message }, 502);
  }
});

// POST /api/admin/tmdb/refresh/:movieId - Refresh metadata from TMDB
admin.post('/tmdb/refresh/:movieId', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('movieId'));

  const db = getDb(c.env.DATABASE_URL);

  const [existing] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  if (!existing.tmdbId || !existing.tmdbMediaType) {
    return c.json({ error: 'Movie has no TMDB association' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    let tmdbData: any;

    if (existing.tmdbMediaType === 'movie') {
      tmdbData = await tmdb.getMovieDetails(existing.tmdbId);
    } else {
      tmdbData = await tmdb.getTVDetails(existing.tmdbId);
    }

    // Refresh metadata
    await db
      .update(movies)
      .set({
        description: tmdbData.overview,
        shortDescription: tmdbData.overview?.substring(0, 300),
        posterUrl: TMDBService.posterUrl(tmdbData.poster_path, 'lg'),
        backdropUrl: TMDBService.backdropUrl(tmdbData.backdrop_path, 'lg'),
        imdbRating: tmdbData.vote_average,
        voteCount: tmdbData.vote_count,
        popularity: tmdbData.popularity,
        posterPath: tmdbData.poster_path,
        backdropPath: tmdbData.backdrop_path,
        overview: tmdbData.overview,
        genres: tmdbData.genres?.map((g: any) => g.name) || [],
        productionCountries: tmdbData.production_countries?.map((c: any) => c.name) || [],
        spokenLanguages: tmdbData.spoken_languages?.map((l: any) => l.english_name || l.name) || [],
        statusTmdb: tmdbData.status,
        metadataUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(movies.id, movieId));

    // Audit log
    await db.insert(auditLogs).values({
      userId,
      action: 'tmdb_refresh',
      entityType: 'movie',
      entityId: movieId,
      details: { tmdbId: existing.tmdbId },
    });

    return c.json({
      success: true,
      movieId,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('TMDB refresh error:', error);
    return c.json({ error: 'TMDB refresh failed', details: error.message }, 502);
  }
});

// GET /api/admin/tmdb/check/:tmdbId?media_type=movie - Check if already imported
admin.get('/tmdb/check/:tmdbId', async (c) => {
  const tmdbId = parseInt(c.req.param('tmdbId'));
  const mediaType = c.req.query('media_type') || 'movie';

  const db = getDb(c.env.DATABASE_URL);

  const [existing] = await db
    .select({ id: movies.id, title: movies.title, slug: movies.slug, status: movies.status })
    .from(movies)
    .where(and(eq(movies.tmdbId, tmdbId), eq(movies.tmdbMediaType, mediaType)))
    .limit(1);

  return c.json({
    imported: !!existing,
    movie: existing || null,
  });
});

// ==================== Source Bindings ====================
// Where a catalogue title can actually be watched: an archive.org identifier, a
// YouTube embed, or a deep link to another free platform.
//
// The download policy is enforced here, not in the UI. An operator cannot mark a
// YouTube or external binding as downloadable, because those platforms do not
// permit it — the request is corrected and the correction is reported back.

type SourceProvider = 'archive' | 'youtube' | 'external' | 'veyra-r2' | 'terabox';
type PlaybackKind = 'video' | 'hls' | 'iframe' | 'external';
type RightsStatus =
  | 'owned'
  | 'licensed'
  | 'public_domain'
  | 'creator_authorized'
  | 'pending_review'
  | 'blocked';

const SOURCE_PROVIDERS: SourceProvider[] = [
  'archive',
  'youtube',
  'external',
  'veyra-r2',
  'terabox',
];
const PLAYBACK_KINDS: PlaybackKind[] = ['video', 'hls', 'iframe', 'external'];
const RIGHTS_STATUSES: RightsStatus[] = [
  'owned',
  'licensed',
  'public_domain',
  'creator_authorized',
  'pending_review',
  'blocked',
];

const DOWNLOADABLE_PROVIDERS = new Set<SourceProvider>(['archive', 'veyra-r2', 'terabox']);
const RIGHTS_THAT_ALLOW_DOWNLOAD = new Set<RightsStatus>([
  'owned',
  'licensed',
  'public_domain',
  'creator_authorized',
]);

const PROVIDER_DEFAULTS: Record<
  SourceProvider,
  { playbackKind: PlaybackKind; downloadPolicy: 'allowed' | 'blocked' }
> = {
  archive: { playbackKind: 'video', downloadPolicy: 'allowed' },
  youtube: { playbackKind: 'iframe', downloadPolicy: 'blocked' },
  external: { playbackKind: 'external', downloadPolicy: 'blocked' },
  'veyra-r2': { playbackKind: 'video', downloadPolicy: 'allowed' },
  terabox: { playbackKind: 'hls', downloadPolicy: 'allowed' },
};

type SourceBindingValue = {
  provider: SourceProvider;
  externalId: string;
  playbackKind: PlaybackKind;
  embedUrl: string | null;
  mediaUrl: string | null;
  externalUrl: string | null;
  downloadPolicy: 'allowed' | 'blocked';
  rightsStatus: RightsStatus;
  license: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  region: string | null;
  priority: number;
  label: string | null;
  episodeId: number | null;
  metadata: Record<string, unknown> | null;
};

function normalizeBinding(body: any) {
  const provider = String(body?.provider || '').trim() as SourceProvider;
  const externalId = String(body?.externalId || '').trim();
  if (!externalId) {
    return { error: 'provider and externalId are required' as const };
  }
  if (!SOURCE_PROVIDERS.includes(provider)) {
    return { error: `Unknown provider: ${String(body?.provider || '')}` as const };
  }
  const defaults = PROVIDER_DEFAULTS[provider];

  const rawRights = String(body?.rightsStatus || 'pending_review') as RightsStatus;
  const rightsStatus = RIGHTS_STATUSES.includes(rawRights) ? rawRights : 'pending_review';
  const rawKind = String(body?.playbackKind || defaults.playbackKind) as PlaybackKind;
  const playbackKind = PLAYBACK_KINDS.includes(rawKind) ? rawKind : defaults.playbackKind;
  const requestedPolicy = body?.downloadPolicy === 'allowed' ? 'allowed' : 'blocked';

  // Downloads require BOTH a provider whose terms allow it AND verified rights.
  const downloadAllowed =
    DOWNLOADABLE_PROVIDERS.has(provider) && RIGHTS_THAT_ALLOW_DOWNLOAD.has(rightsStatus);
  const downloadPolicy = downloadAllowed ? 'allowed' : 'blocked';

  const corrected = requestedPolicy === 'allowed' && downloadPolicy === 'blocked';

  const value: SourceBindingValue = {
    provider,
    externalId,
    playbackKind,
    embedUrl: body?.embedUrl ? String(body.embedUrl) : null,
    mediaUrl: body?.mediaUrl ? String(body.mediaUrl) : null,
    externalUrl: body?.externalUrl ? String(body.externalUrl) : null,
    downloadPolicy,
    rightsStatus,
    license: body?.license ? String(body.license).slice(0, 64) : null,
    licenseUrl: body?.licenseUrl ? String(body.licenseUrl) : null,
    attribution: body?.attribution ? String(body.attribution) : null,
    region: body?.region ? String(body.region).toUpperCase().slice(0, 2) : null,
    priority: Number.isFinite(Number(body?.priority)) ? Number(body.priority) : 5,
    label: body?.label ? String(body.label).slice(0, 120) : null,
    episodeId: body?.episodeId ? Number(body.episodeId) : null,
    metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : null,
  };

  return {
    value,
    corrected,
    reason: corrected
      ? downloadAllowed
        ? undefined
        : `${provider} bindings cannot be downloadable unless rights are verified (rights_status must be owned, licensed, public_domain or creator_authorized).`
      : undefined,
  };
}

// GET /api/admin/movies/:id/sources
admin.get('/movies/:id/sources', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('id'), 10);

  const sourceList = await db
    .select()
    .from(mediaSources)
    .where(eq(mediaSources.movieId, movieId))
    .orderBy(asc(mediaSources.priority), asc(mediaSources.id));

  return c.json({ sources: sourceList });
});

// POST /api/admin/movies/:id/sources — bind a playback source
admin.post('/movies/:id/sources', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));

  const [movie] = await db
    .select({ id: movies.id, title: movies.title })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);
  if (!movie) return c.json({ error: 'Movie not found' }, 404);

  const normalized = normalizeBinding(body);
  if ('error' in normalized) return c.json({ error: normalized.error }, 400);
  const binding = normalized.value;

  const [created] = await db
    .insert(mediaSources)
    .values({ movieId, ...binding, verifiedAt: new Date() })
    .returning();

  await db.insert(auditLogs).values({
    userId: userId || null,
    action: 'source.bind',
    entityType: 'media_source',
    entityId: created.id,
    details: { movieId, provider: binding.provider, externalId: binding.externalId },
    ipAddress: c.req.header('CF-Connecting-IP') || null,
  });

  return c.json({
    source: created,
    // Tell the operator when we overrode their download request, and why.
    corrected: normalized.corrected,
    reason: normalized.reason,
  }, 201);
});

// PUT /api/admin/sources/:sourceId
admin.put('/sources/:sourceId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const sourceId = parseInt(c.req.param('sourceId'), 10);
  const body = await c.req.json().catch(() => ({}));

  const [existing] = await db
    .select()
    .from(mediaSources)
    .where(eq(mediaSources.id, sourceId))
    .limit(1);
  if (!existing) return c.json({ error: 'Source binding not found' }, 404);

  const normalized = normalizeBinding({
    provider: body.provider ?? existing.provider,
    externalId: body.externalId ?? existing.externalId,
    playbackKind: body.playbackKind ?? existing.playbackKind,
    embedUrl: body.embedUrl ?? existing.embedUrl,
    mediaUrl: body.mediaUrl ?? existing.mediaUrl,
    externalUrl: body.externalUrl ?? existing.externalUrl,
    downloadPolicy: body.downloadPolicy ?? existing.downloadPolicy,
    rightsStatus: body.rightsStatus ?? existing.rightsStatus,
    license: body.license ?? existing.license,
    licenseUrl: body.licenseUrl ?? existing.licenseUrl,
    attribution: body.attribution ?? existing.attribution,
    region: body.region ?? existing.region,
    priority: body.priority ?? existing.priority,
    label: body.label ?? existing.label,
    episodeId: body.episodeId ?? existing.episodeId,
    metadata: body.metadata ?? existing.metadata,
  });
  if ('error' in normalized) return c.json({ error: normalized.error }, 400);

  const [updated] = await db
    .update(mediaSources)
    .set({ ...normalized.value, updatedAt: new Date() })
    .where(eq(mediaSources.id, sourceId))
    .returning();

  await db.insert(auditLogs).values({
    userId: userId || null,
    action: 'source.update',
    entityType: 'media_source',
    entityId: sourceId,
    details: { provider: normalized.value.provider },
    ipAddress: c.req.header('CF-Connecting-IP') || null,
  });

  return c.json({ source: updated, corrected: normalized.corrected, reason: normalized.reason });
});

// DELETE /api/admin/sources/:sourceId
admin.delete('/sources/:sourceId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const sourceId = parseInt(c.req.param('sourceId'), 10);

  const [existing] = await db
    .select()
    .from(mediaSources)
    .where(eq(mediaSources.id, sourceId))
    .limit(1);
  if (!existing) return c.json({ error: 'Source binding not found' }, 404);

  await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));

  await db.insert(auditLogs).values({
    userId: userId || null,
    action: 'source.delete',
    entityType: 'media_source',
    entityId: sourceId,
    details: { movieId: existing.movieId, provider: existing.provider },
    ipAddress: c.req.header('CF-Connecting-IP') || null,
  });

  return c.json({ success: true });
});

// POST /api/admin/sources/:sourceId/verify — does the binding still resolve?
// archive.org bindings are checked against the live metadata API; YouTube
// bindings are checked for a well-formed, embeddable-looking id.
admin.post('/sources/:sourceId/verify', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const sourceId = parseInt(c.req.param('sourceId'), 10);

  const [binding] = await db
    .select()
    .from(mediaSources)
    .where(eq(mediaSources.id, sourceId))
    .limit(1);
  if (!binding) return c.json({ error: 'Source binding not found' }, 404);

  if (binding.provider === 'archive') {
    try {
      const response = await fetch(
        `https://archive.org/metadata/${encodeURIComponent(binding.externalId)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) {
        return c.json({ ok: false, reason: `archive.org responded ${response.status}` }, 200);
      }
      const payload = (await response.json()) as {
        isDark?: boolean;
        files?: Array<{ name: string; format?: string }>;
        metadata?: { licenseurl?: string; title?: string };
      };
      if (payload.isDark) {
        return c.json({ ok: false, reason: 'This item is dark (restricted) on archive.org' }, 200);
      }
      const videoFiles = (payload.files || []).filter((f) =>
        /\.(mp4|webm|m4v)$/i.test(f.name)
      );
      const [updated] = await db
        .update(mediaSources)
        .set({
          verifiedAt: new Date(),
          updatedAt: new Date(),
          license: payload.metadata?.licenseurl
            ? String(payload.metadata.licenseurl).slice(0, 64)
            : binding.license,
          label: binding.label || payload.metadata?.title?.slice(0, 120) || null,
        })
        .where(eq(mediaSources.id, sourceId))
        .returning();

      return c.json({
        ok: videoFiles.length > 0,
        reason:
          videoFiles.length > 0
            ? `${videoFiles.length} playable file(s) found`
            : 'Item exists but archive.org has no browser-playable derivative yet',
        source: updated,
      });
    } catch (error: any) {
      return c.json({ ok: false, reason: error?.message || 'Verification failed' }, 200);
    }
  }

  if (binding.provider === 'youtube') {
    const id = binding.externalId.trim();
    const valid = /^[\w-]{11}$/.test(id) || /^(PL|UU|OL|FL)[\w-]{10,}$/.test(id);
    const [updated] = await db
      .update(mediaSources)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(mediaSources.id, sourceId))
      .returning();
    return c.json({
      ok: valid,
      reason: valid
        ? 'Identifier is well formed. Playback still depends on the uploader allowing embeds.'
        : 'Expected an 11-character video id or a playlist id (PL…)',
      source: updated,
    });
  }

  return c.json({
    ok: Boolean(binding.externalUrl || binding.mediaUrl || binding.embedUrl),
    reason: 'Deep-link bindings are verified by having a destination URL.',
  });
});

export { admin as adminRoutes };
