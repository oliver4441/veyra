import { Hono } from 'hono';
import { sql, eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, genres, movieGenres } from '../db/schema';
import type { Env } from '../index';

const search = new Hono<{ Bindings: Env }>();

// GET /api/search?q=query&page=1&limit=20
search.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  const genre = c.req.query('genre');
  const year = c.req.query('year');
  const type = c.req.query('type');

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Search query is required' }, 400);
  }

  // Build search conditions
  const searchPattern = `%${query.toLowerCase()}%`;

  let results = await db
    .select({
      id: movies.id,
      title: movies.title,
      slug: movies.slug,
      shortDescription: movies.shortDescription,
      type: movies.type,
      year: movies.year,
      duration: movies.duration,
      rating: movies.rating,
      imdbRating: movies.imdbRating,
      posterUrl: movies.posterUrl,
      backdropUrl: movies.backdropUrl,
      director: movies.director,
      cast: movies.cast,
      tags: movies.tags,
      status: movies.status,
    })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`(lower(${movies.title}) LIKE ${searchPattern} OR lower(${movies.description}) LIKE ${searchPattern} OR lower(${movies.director}) LIKE ${searchPattern})`
      )
    )
    .limit(limit)
    .offset(offset);

  // If year filter is provided
  if (year) {
    results = results.filter((r) => r.year === parseInt(year));
  }

  // If type filter is provided
  if (type) {
    results = results.filter((r) => r.type === type);
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`(lower(${movies.title}) LIKE ${searchPattern} OR lower(${movies.description}) LIKE ${searchPattern} OR lower(${movies.director}) LIKE ${searchPattern})`
      )
    );

  return c.json({
    results,
    query,
    pagination: {
      page,
      limit,
      total: countResult.count,
      totalPages: Math.ceil(countResult.count / limit),
    },
  });
});

// GET /api/search/suggestions?q=query - Autocomplete suggestions
search.get('/suggestions', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const query = c.req.query('q');

  if (!query || query.trim().length < 2) {
    return c.json({ suggestions: [] });
  }

  const searchPattern = `%${query.toLowerCase()}%`;

  const suggestions = await db
    .select({
      id: movies.id,
      title: movies.title,
      slug: movies.slug,
      type: movies.type,
      year: movies.year,
      posterUrl: movies.posterUrl,
    })
    .from(movies)
    .where(
      and(
        eq(movies.status, 'published'),
        sql`lower(${movies.title}) LIKE ${searchPattern}`
      )
    )
    .limit(8);

  return c.json({ suggestions });
});

export { search as searchRoutes };
