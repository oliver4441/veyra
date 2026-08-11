import { Hono } from 'hono';
import { eq, desc, asc, sql, and, inArray } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, genres, movieGenres, series, seasons, episodes, mediaFiles } from '../db/schema';
import type { Env } from '../index';

const moviesRouter = new Hono<{ Bindings: Env }>();

// GET /api/movies - List movies with pagination and filtering
moviesRouter.get('/', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;
  const genreId = c.req.query('genre');
  const type = c.req.query('type'); // movie or series

  let query = db
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
      status: movies.status,
      featured: movies.featured,
      trending: movies.trending,
      viewCount: movies.viewCount,
      createdAt: movies.createdAt,
    })
    .from(movies)
    .where(eq(movies.status, 'published'));

  if (genreId) {
    // Filter by genre using a subquery
    const genreMovieIds = db
      .select({ movieId: movieGenres.movieId })
      .from(movieGenres)
      .where(eq(movieGenres.genreId, parseInt(genreId)));

    query = db
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
        status: movies.status,
        featured: movies.featured,
        trending: movies.trending,
        viewCount: movies.viewCount,
        createdAt: movies.createdAt,
      })
      .from(movies)
      .where(
        and(
          eq(movies.status, 'published'),
          sql`${movies.id} IN (SELECT movie_id FROM movie_genres WHERE genre_id = ${parseInt(genreId)})`
        )
      );
  }

  if (type) {
    query = query.where(and(eq(movies.status, 'published'), eq(movies.type, type as 'movie' | 'series')));
  }

  const results = await query
    .orderBy(desc(movies.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(movies)
    .where(eq(movies.status, 'published'));

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

// GET /api/movies/featured - Featured movies for hero section
moviesRouter.get('/featured', async (c) => {
  const db = getDb(c.env.DATABASE_URL);

  const featured = await db
    .select()
    .from(movies)
    .where(and(eq(movies.status, 'published'), eq(movies.featured, true)))
    .orderBy(desc(movies.viewCount))
    .limit(5);

  return c.json({ movies: featured });
});

// GET /api/movies/trending - Trending movies
moviesRouter.get('/trending', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  const trending = await db
    .select()
    .from(movies)
    .where(and(eq(movies.status, 'published'), eq(movies.trending, true)))
    .orderBy(desc(movies.viewCount))
    .limit(limit);

  return c.json({ movies: trending });
});

// GET /api/movies/continue-watching - Continue watching for user
moviesRouter.get('/continue-watching', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  // This would need auth middleware to get user ID
  // For now, return empty array
  return c.json({ movies: [] });
});

// GET /api/movies/:slug - Get movie by slug
moviesRouter.get('/:slug', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const slug = c.req.param('slug');

  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.slug, slug))
    .limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  // Get genres for this movie
  const movieGenreList = await db
    .select({
      id: genres.id,
      name: genres.name,
      slug: genres.slug,
    })
    .from(genres)
    .innerJoin(movieGenres, eq(genres.id, movieGenres.genreId))
    .where(eq(movieGenres.movieId, movie.id));

  // Get series info if it's a series
  let seriesInfo = null;
  let seasonList = null;

  if (movie.type === 'series') {
    const [seriesData] = await db
      .select()
      .from(series)
      .where(eq(series.movieId, movie.id))
      .limit(1);

    if (seriesData) {
      seriesInfo = seriesData;

      seasonList = await db
        .select()
        .from(seasons)
        .where(eq(seasons.seriesId, seriesData.id))
        .orderBy(asc(seasons.seasonNumber));

      // Get episodes for each season
      if (seasonList) {
        for (const season of seasonList) {
          const seasonEpisodes = await db
            .select()
            .from(episodes)
            .where(eq(episodes.seasonId, season.id))
            .orderBy(asc(episodes.episodeNumber));

          (season as any).episodes = seasonEpisodes;
        }
      }
    }
  }

  // Get media files
  const mediaFilesList = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.movieId, movie.id));

  return c.json({
    movie: {
      ...movie,
      genres: movieGenreList,
      series: seriesInfo,
      seasons: seasonList,
      mediaFiles: mediaFilesList,
    },
  });
});

// GET /api/movies/:slug/episodes - Get episodes for a series
moviesRouter.get('/:slug/episodes', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const slug = c.req.param('slug');

  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.slug, slug))
    .limit(1);

  if (!movie || movie.type !== 'series') {
    return c.json({ error: 'Series not found' }, 404);
  }

  const [seriesData] = await db
    .select()
    .from(series)
    .where(eq(series.movieId, movie.id))
    .limit(1);

  if (!seriesData) {
    return c.json({ error: 'Series data not found' }, 404);
  }

  const seasonList = await db
    .select()
    .from(seasons)
    .where(eq(seasons.seriesId, seriesData.id))
    .orderBy(asc(seasons.seasonNumber));

  // Get episodes for each season
  for (const season of seasonList) {
    const seasonEpisodes = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, season.id))
      .orderBy(asc(episodes.episodeNumber));

    (season as any).episodes = seasonEpisodes;
  }

  return c.json({ seasons: seasonList });
});

export { moviesRouter as movieRoutes };
