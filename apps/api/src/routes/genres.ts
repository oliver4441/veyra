import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { genres } from '../db/schema';
import type { Env } from '../index';

const genreRouter = new Hono<{ Bindings: Env }>();

// GET /api/genres - List all genres
genreRouter.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL);

  const allGenres = await db
    .select()
    .from(genres)
    .orderBy(asc(genres.name));

  return c.json({ genres: allGenres });
});

// GET /api/genres/:slug - Get genre by slug
genreRouter.get('/:slug', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const slug = c.req.param('slug');

  const [genre] = await db
    .select()
    .from(genres)
    .where(eq(genres.slug, slug))
    .limit(1);

  if (!genre) {
    return c.json({ error: 'Genre not found' }, 404);
  }

  return c.json({ genre });
});

export { genreRouter as genreRoutes };
