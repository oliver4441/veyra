import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
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
import type { Env } from '../index';

const admin = new Hono<{ Bindings: Env }>();

// Middleware to check admin role
admin.use('*', async (c, next) => {
  const payload = (c as any).get('jwtPayload');
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('userId', payload.userId);
  c.set('userRole', payload.role);
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

  let query = db.select().from(movies);

  if (status) {
    query = query.where(eq(movies.status, status as any));
  }

  const results = await query
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
  const userId = (c as any).get('userId') as number;
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
  const userId = (c as any).get('userId') as number;
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
  const userId = (c as any).get('userId') as number;
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
  const userId = (c as any).get('userId') as number;
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

export { admin as adminRoutes };
