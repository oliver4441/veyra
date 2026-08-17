import { Hono } from 'hono';
import { eq, desc, sql, and } from 'drizzle-orm';
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
  users,
  auditLogs,
} from '../db/schema';
import type { AppContext } from '../index';

const admin = new Hono<AppContext>();

// Middleware to check admin role (userRole is resolved from Firebase in index.ts)
admin.use('*', async (c, next) => {
  const role = c.get('userRole');
  if (!role || (role !== 'admin' && role !== 'superadmin')) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
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

export { admin as adminRoutes };
