import { Hono } from 'hono';
import { getTMDB, TMDBService, type TMDBTrendingItem, type TMDBMovieResult, type TVResult } from '../lib/tmdb';
import type { Env } from '../index';

const discovery = new Hono<{ Bindings: Env }>();

// ── Search ───────────────────────────────────────────────────────

// GET /api/discovery/search?q=&page=1&media_type=multi
discovery.get('/search', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const query = c.req.query('q');
  const page = parseInt(c.req.query('page') || '1');
  const mediaType = c.req.query('media_type') || 'multi'; // multi, movie, tv

  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Search query is required' }, 400);
  }

  try {
    const tmdb = getTMDB(token);

    let results;
    if (mediaType === 'movie') {
      const res = await tmdb.searchMovies(query, page);
      results = { ...res, results: res.results.map(normalizeMovieResult) };
    } else if (mediaType === 'tv') {
      const res = await tmdb.searchTV(query, page);
      results = { ...res, results: res.results.map(normalizeTVResult) };
    } else {
      const res = await tmdb.searchMulti(query, page);
      results = {
        ...res,
        results: res.results.map(normalizeTrendingItem),
      };
    }

    return c.json(results);
  } catch (error: any) {
    console.error('TMDB search error:', error);
    return c.json({ error: 'TMDB search failed', details: error.message }, 502);
  }
});

// GET /api/discovery/suggestions?q=&limit=8
discovery.get('/suggestions', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ suggestions: [] });
  }

  const query = c.req.query('q');
  const limit = parseInt(c.req.query('limit') || '8');

  if (!query || query.trim().length < 2) {
    return c.json({ suggestions: [] });
  }

  try {
    const tmdb = getTMDB(token);
    const res = await tmdb.searchMulti(query, 1);

    const suggestions = res.results.slice(0, limit).map((item) => ({
      tmdbId: item.id,
      mediaType: item.media_type,
      title: item.title || item.name || '',
      posterPath: item.poster_path,
      releaseDate: item.release_date || item.first_air_date,
      voteAverage: item.vote_average,
    }));

    return c.json({ suggestions });
  } catch (error: any) {
    return c.json({ suggestions: [] });
  }
});

// ── Trending ─────────────────────────────────────────────────────

// GET /api/discovery/trending?time_window=day&page=1
discovery.get('/trending', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const timeWindow = (c.req.query('time_window') || 'day') as 'day' | 'week';
  const page = parseInt(c.req.query('page') || '1');

  try {
    const tmdb = getTMDB(token);
    const res = await tmdb.getTrending('all', timeWindow, page);

    return c.json({
      page: res.page,
      totalPages: res.total_pages,
      totalResults: res.total_results,
      results: res.results.map(normalizeTrendingItem),
    });
  } catch (error: any) {
    console.error('TMDB trending error:', error);
    return c.json({ error: 'TMDB trending failed', details: error.message }, 502);
  }
});

// ── Popular ──────────────────────────────────────────────────────

// GET /api/discovery/popular?media_type=movie&page=1
discovery.get('/popular', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const mediaType = (c.req.query('media_type') || 'movie') as 'movie' | 'tv';
  const page = parseInt(c.req.query('page') || '1');

  try {
    const tmdb = getTMDB(token);

    if (mediaType === 'tv') {
      const res = await tmdb.getPopularTV(page);
      return c.json({
        page: res.page,
        totalPages: res.total_pages,
        totalResults: res.total_results,
        results: res.results.map(normalizeTVResult),
      });
    }

    const res = await tmdb.getPopularMovies(page);
    return c.json({
      page: res.page,
      totalPages: res.total_pages,
      totalResults: res.total_results,
      results: res.results.map(normalizeMovieResult),
    });
  } catch (error: any) {
    console.error('TMDB popular error:', error);
    return c.json({ error: 'TMDB popular failed', details: error.message }, 502);
  }
});

// ── Details ──────────────────────────────────────────────────────

// GET /api/discovery/movie/:tmdbId
discovery.get('/movie/:tmdbId', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const tmdbId = parseInt(c.req.param('tmdbId'));
  if (isNaN(tmdbId)) {
    return c.json({ error: 'Invalid TMDB ID' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    const movie = await tmdb.getMovieDetails(tmdbId);

    return c.json({
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      overview: movie.overview,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      releaseDate: movie.release_date,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity,
      runtime: movie.runtime,
      genres: movie.genres.map((g) => g.name),
      productionCountries: movie.production_countries.map((c) => c.name),
      spokenLanguages: movie.spoken_languages.map((l) => l.english_name),
      status: movie.status,
      tagline: movie.tagline,
      originalLanguage: movie.original_language,
      posterUrl: TMDBService.posterUrl(movie.poster_path, 'lg'),
      backdropUrl: TMDBService.backdropUrl(movie.backdrop_path, 'original'),
      trailer: movie.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key || null,
      cast: movie.credits?.cast?.slice(0, 20).map((c) => ({
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
        profileUrl: TMDBService.profileUrl(c.profile_path),
      })) || [],
      director: movie.credits?.crew?.find((c) => c.job === 'Director')?.name || null,
    });
  } catch (error: any) {
    console.error('TMDB movie detail error:', error);
    return c.json({ error: 'TMDB movie details failed', details: error.message }, 502);
  }
});

// GET /api/discovery/tv/:tmdbId
discovery.get('/tv/:tmdbId', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const tmdbId = parseInt(c.req.param('tmdbId'));
  if (isNaN(tmdbId)) {
    return c.json({ error: 'Invalid TMDB ID' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    const tv = await tmdb.getTVDetails(tmdbId);

    return c.json({
      tmdbId: tv.id,
      title: tv.name,
      originalTitle: tv.original_name,
      overview: tv.overview,
      posterPath: tv.poster_path,
      backdropPath: tv.backdrop_path,
      releaseDate: tv.first_air_date,
      voteAverage: tv.vote_average,
      voteCount: tv.vote_count,
      popularity: tv.popularity,
      genres: tv.genres.map((g) => g.name),
      productionCountries: tv.production_countries.map((c) => c.name),
      spokenLanguages: tv.spoken_languages.map((l) => l.english_name),
      status: tv.status,
      tagline: tv.tagline,
      originalLanguage: tv.original_language,
      numberOfSeasons: tv.number_of_seasons,
      numberOfEpisodes: tv.number_of_episodes,
      seasons: tv.seasons.map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: s.poster_path,
        airDate: s.air_date,
        episodeCount: s.episode_count,
      })),
      posterUrl: TMDBService.posterUrl(tv.poster_path, 'lg'),
      backdropUrl: TMDBService.backdropUrl(tv.backdrop_path, 'original'),
      trailer: tv.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key || null,
      cast: tv.credits?.cast?.slice(0, 20).map((c) => ({
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
        profileUrl: TMDBService.profileUrl(c.profile_path),
      })) || [],
    });
  } catch (error: any) {
    console.error('TMDB TV detail error:', error);
    return c.json({ error: 'TMDB TV details failed', details: error.message }, 502);
  }
});

// ── Recommendations ──────────────────────────────────────────────

// GET /api/discovery/movie/:tmdbId/recommendations
discovery.get('/movie/:tmdbId/recommendations', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const tmdbId = parseInt(c.req.param('tmdbId'));
  if (isNaN(tmdbId)) {
    return c.json({ error: 'Invalid TMDB ID' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    const res = await tmdb.getMovieRecommendations(tmdbId);

    return c.json({
      results: res.results.map(normalizeMovieResult),
    });
  } catch (error: any) {
    return c.json({ error: 'TMDB recommendations failed', details: error.message }, 502);
  }
});

// GET /api/discovery/tv/:tmdbId/recommendations
discovery.get('/tv/:tmdbId/recommendations', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  const tmdbId = parseInt(c.req.param('tmdbId'));
  if (isNaN(tmdbId)) {
    return c.json({ error: 'Invalid TMDB ID' }, 400);
  }

  try {
    const tmdb = getTMDB(token);
    const res = await tmdb.getTVRecommendations(tmdbId);

    return c.json({
      results: res.results.map(normalizeTVResult),
    });
  } catch (error: any) {
    return c.json({ error: 'TMDB recommendations failed', details: error.message }, 502);
  }
});

// ── Genres ───────────────────────────────────────────────────────

// GET /api/discovery/genres
discovery.get('/genres', async (c) => {
  const token = c.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    return c.json({ error: 'TMDB not configured' }, 503);
  }

  try {
    const tmdb = getTMDB(token);
    const [movieGenres, tvGenres] = await Promise.all([
      tmdb.getMovieGenres(),
      tmdb.getTVGenres(),
    ]);

    // Merge and dedupe genres
    const genreMap = new Map<number, { id: number; name: string }>();
    for (const g of [...movieGenres.genres, ...tvGenres.genres]) {
      genreMap.set(g.id, g);
    }

    return c.json({ genres: Array.from(genreMap.values()).sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error: any) {
    return c.json({ error: 'TMDB genres failed', details: error.message }, 502);
  }
});

// ── Normalizers ──────────────────────────────────────────────────
// These convert raw TMDB responses into a consistent format

function normalizeMovieResult(item: TMDBMovieResult) {
  return {
    tmdbId: item.id,
    mediaType: 'movie' as const,
    title: item.title,
    originalTitle: item.original_title,
    overview: item.overview,
    releaseDate: item.release_date,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    originalLanguage: item.original_language,
    genreIds: item.genre_ids,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    posterUrl: TMDBService.posterUrl(item.poster_path, 'md'),
    backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'md'),
  };
}

function normalizeTVResult(item: TVResult) {
  return {
    tmdbId: item.id,
    mediaType: 'tv' as const,
    title: item.name,
    originalTitle: item.original_name,
    overview: item.overview,
    releaseDate: item.first_air_date,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    originalLanguage: item.original_language,
    genreIds: item.genre_ids,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    posterUrl: TMDBService.posterUrl(item.poster_path, 'md'),
    backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'md'),
  };
}

function normalizeTrendingItem(item: TMDBTrendingItem) {
  return {
    tmdbId: item.id,
    mediaType: item.media_type,
    title: item.title || item.name || '',
    originalTitle: item.original_title || item.original_name || '',
    overview: item.overview,
    releaseDate: item.release_date || item.first_air_date || '',
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    popularity: item.popularity,
    originalLanguage: item.original_language,
    genreIds: item.genre_ids,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    posterUrl: TMDBService.posterUrl(item.poster_path, 'md'),
    backdropUrl: TMDBService.backdropUrl(item.backdrop_path, 'md'),
  };
}

export { discovery as discoveryRoutes };
