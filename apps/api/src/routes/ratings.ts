import { Hono } from 'hono';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { ratings, movies, users } from '../db/schema';
import type { AppContext } from '../index';

const ratingsRoutes = new Hono<AppContext>();

// Middleware to extract user (userId is resolved from Firebase in index.ts)
ratingsRoutes.use('*', async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  await next();
});

// GET /api/ratings/movie/:movieId - Get ratings for a movie
ratingsRoutes.get('/movie/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('movieId'));

  // Get all ratings for this movie with user info
  const movieRatings = await db
    .select({
      id: ratings.id,
      rating: ratings.rating,
      review: ratings.review,
      createdAt: ratings.createdAt,
      updatedAt: ratings.updatedAt,
      userId: ratings.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(ratings)
    .innerJoin(users, eq(ratings.userId, users.id))
    .where(eq(ratings.movieId, movieId))
    .orderBy(desc(ratings.createdAt));

  // Get aggregate stats
  const [stats] = await db
    .select({
      avgRating: sql<number>`round(cast(avg(${ratings.rating}) as numeric), 1)`,
      totalRatings: count(ratings.id),
    })
    .from(ratings)
    .where(eq(ratings.movieId, movieId));

  // Get current user's rating
  const userId = c.get('userId');
  const [userRating] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.movieId, movieId), eq(ratings.userId, userId)))
    .limit(1);

  return c.json({
    ratings: movieRatings,
    stats: {
      average: stats?.avgRating || 0,
      total: stats?.totalRatings || 0,
    },
    userRating: userRating || null,
  });
});

// POST /api/ratings - Create or update a rating
ratingsRoutes.post('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const body = await c.req.json();
  const { movieId, rating, review } = body;

  if (!movieId || !rating) {
    return c.json({ error: 'movieId and rating are required' }, 400);
  }

  if (rating < 1 || rating > 10) {
    return c.json({ error: 'Rating must be between 1 and 10' }, 400);
  }

  // Verify movie exists
  const [movie] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  // Check if user already rated this movie
  const [existing] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.movieId, movieId), eq(ratings.userId, userId)))
    .limit(1);

  if (existing) {
    // Update existing rating
    await db
      .update(ratings)
      .set({
        rating,
        review: review || existing.review,
        updatedAt: new Date(),
      })
      .where(eq(ratings.id, existing.id));

    return c.json({ success: true, updated: true });
  }

  // Create new rating
  await db.insert(ratings).values({
    userId,
    movieId,
    rating,
    review: review || undefined,
  });

  return c.json({ success: true, updated: false }, 201);
});

// DELETE /api/ratings/:movieId - Delete user's rating for a movie
ratingsRoutes.delete('/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const movieId = parseInt(c.req.param('movieId'));

  await db
    .delete(ratings)
    .where(and(eq(ratings.movieId, movieId), eq(ratings.userId, userId)));

  return c.json({ success: true });
});

// GET /api/ratings/user - Get all ratings by current user
ratingsRoutes.get('/user', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '50');

  const userRatings = await db
    .select({
      id: ratings.id,
      rating: ratings.rating,
      review: ratings.review,
      createdAt: ratings.createdAt,
      movie: {
        id: movies.id,
        title: movies.title,
        slug: movies.slug,
        posterUrl: movies.posterUrl,
        year: movies.year,
        type: movies.type,
      },
    })
    .from(ratings)
    .innerJoin(movies, eq(ratings.movieId, movies.id))
    .where(eq(ratings.userId, userId))
    .orderBy(desc(ratings.createdAt))
    .limit(limit);

  return c.json({ ratings: userRatings });
});

export { ratingsRoutes };
