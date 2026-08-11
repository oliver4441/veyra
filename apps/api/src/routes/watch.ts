import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../lib/db';
import {
  watchHistory,
  watchProgress,
  watchlists,
  movies,
  episodes,
} from '../db/schema';
import type { Env } from '../index';

const watch = new Hono<{ Bindings: Env }>();

// Middleware to extract user from JWT
watch.use('*', async (c, next) => {
  const payload = (c as any).get('jwtPayload');
  if (!payload) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  c.set('userId', payload.userId);
  await next();
});

// GET /api/watch/progress - Get watch progress for all movies
watch.get('/progress', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;

  const progress = await db
    .select()
    .from(watchProgress)
    .where(eq(watchProgress.userId, userId))
    .orderBy(desc(watchProgress.updatedAt));

  return c.json({ progress });
});

// GET /api/watch/progress/:movieId - Get progress for specific movie
watch.get('/progress/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;
  const movieId = parseInt(c.req.param('movieId'));

  const [progress] = await db
    .select()
    .from(watchProgress)
    .where(
      and(
        eq(watchProgress.userId, userId),
        eq(watchProgress.movieId, movieId)
      )
    )
    .limit(1);

  return c.json({ progress: progress || null });
});

// POST /api/watch/progress - Update watch progress
watch.post('/progress', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;
  const body = await c.req.json();
  const { movieId, episodeId, position, duration } = body;

  if (!movieId && !episodeId) {
    return c.json({ error: 'movieId or episodeId is required' }, 400);
  }

  if (position === undefined || duration === undefined) {
    return c.json({ error: 'position and duration are required' }, 400);
  }

  const completed = position >= duration * 0.9; // 90% watched = completed

  // Check if progress exists
  const existingWhere = movieId
    ? and(
        eq(watchProgress.userId, userId),
        eq(watchProgress.movieId, movieId)
      )
    : and(
        eq(watchProgress.userId, userId),
        eq(watchProgress.episodeId, episodeId!)
      );

  const [existing] = await db
    .select()
    .from(watchProgress)
    .where(existingWhere)
    .limit(1);

  if (existing) {
    // Update existing progress
    await db
      .update(watchProgress)
      .set({
        position,
        duration,
        completed,
        updatedAt: new Date(),
      })
      .where(eq(watchProgress.id, existing.id));
  } else {
    // Create new progress
    await db.insert(watchProgress).values({
      userId,
      movieId: movieId || undefined,
      episodeId: episodeId || undefined,
      position,
      duration,
      completed,
    });
  }

  // Also add to watch history
  await db.insert(watchHistory).values({
    userId,
    movieId: movieId || undefined,
    episodeId: episodeId || undefined,
    duration: position,
  });

  return c.json({ success: true });
});

// GET /api/watch/history - Get watch history
watch.get('/history', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;
  const limit = parseInt(c.req.query('limit') || '20');

  const history = await db
    .select()
    .from(watchHistory)
    .where(eq(watchHistory.userId, userId))
    .orderBy(desc(watchHistory.watchedAt))
    .limit(limit);

  return c.json({ history });
});

// GET /api/watch/streaming-url/:movieId - Get streaming URL for a movie
watch.get('/streaming-url/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('movieId'));
  const quality = c.req.query('quality') || '1080';

  // Get movie
  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  if (!movie.streamingEnabled) {
    return c.json({ error: 'Streaming not enabled for this title' }, 403);
  }

  // TODO: Integrate with TeraBox API to get actual streaming URL
  // For now, return a placeholder
  return c.json({
    movieId,
    quality,
    streamingUrl: `https://placeholder.veyra.app/stream/${movieId}/${quality}/playlist.m3u8`,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
  });
});

// GET /api/watchlist - Get user's watchlist
watch.get('/watchlist', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;

  const watchlist = await db
    .select({
      id: watchlists.id,
      addedAt: watchlists.addedAt,
      movie: {
        id: movies.id,
        title: movies.title,
        slug: movies.slug,
        type: movies.type,
        year: movies.year,
        posterUrl: movies.posterUrl,
        rating: movies.rating,
      },
    })
    .from(watchlists)
    .innerJoin(movies, eq(watchlists.movieId, movies.id))
    .where(eq(watchlists.userId, userId))
    .orderBy(desc(watchlists.addedAt));

  return c.json({ watchlist });
});

// POST /api/watchlist - Add movie to watchlist
watch.post('/watchlist', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;
  const body = await c.req.json();
  const { movieId } = body;

  if (!movieId) {
    return c.json({ error: 'movieId is required' }, 400);
  }

  // Check if already in watchlist
  const [existing] = await db
    .select()
    .from(watchlists)
    .where(
      and(
        eq(watchlists.userId, userId),
        eq(watchlists.movieId, movieId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: 'Already in watchlist' }, 409);
  }

  await db.insert(watchlists).values({
    userId,
    movieId,
  });

  return c.json({ success: true }, 201);
});

// DELETE /api/watchlist/:movieId - Remove from watchlist
watch.delete('/watchlist/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = (c as any).get('userId') as number;
  const movieId = parseInt(c.req.param('movieId'));

  await db
    .delete(watchlists)
    .where(
      and(
        eq(watchlists.userId, userId),
        eq(watchlists.movieId, movieId)
      )
    );

  return c.json({ success: true });
});

export { watch as watchRoutes };
