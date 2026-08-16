// TMDB API v3 Service Client
// Centralized, server-side only. Never expose the token to the browser.

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ── Image URL Sizes ──────────────────────────────────────────────
export const TMDB_IMAGE_SIZES = {
  poster: {
    sm: 'w342',
    md: 'w500',
    lg: 'w780',
    original: 'original',
  },
  backdrop: {
    sm: 'w780',
    md: 'w1280',
    lg: 'original',
    original: 'original',
  },
  profile: {
    sm: 'w185',
    md: 'h632',
    original: 'original',
  },
  still: {
    sm: 'w300',
    md: 'w780',
    original: 'original',
  },
} as const;

export type TMDBImageSize = 'sm' | 'md' | 'lg' | 'original';

// ── Types ────────────────────────────────────────────────────────

export interface TMDBMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  media_type?: string; // present in mixed search results
}

export interface TVResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  media_type?: string;
}

export interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_results: number;
  total_pages: number;
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ english_name: string; iso_639_1: string; name: string }>;
  status: string; // 'Released', 'Post Production', etc.
  tagline: string;
  budget: number;
  revenue: number;
  homepage: string | null;
  imdb_id: string | null;
  original_language: string;
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null };
  videos?: { results: Array<{ key: string; site: string; type: string }> };
  credits?: {
    cast: Array<{ id: number; name: string; character: string; profile_path: string | null; order: number }>;
    crew: Array<{ id: number; name: string; job: string; department: string }>;
  };
}

export interface TMDBTVDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ english_name: string; iso_639_1: string; name: string }>;
  status: string;
  tagline: string;
  homepage: string | null;
  original_language: string;
  seasons: Array<{
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string;
    episode_count: number;
  }>;
  videos?: { results: Array<{ key: string; site: string; type: string }> };
  credits?: {
    cast: Array<{ id: number; name: string; character: string; profile_path: string | null; order: number }>;
    crew: Array<{ id: number; name: string; job: string; department: string }>;
  };
}

export interface TMDBTrendingItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  media_type: 'movie' | 'tv';
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBDiscoverParams {
  media_type: 'movie' | 'tv';
  page?: number;
  sort_by?: string;
  with_genres?: string;
  primary_release_year?: number;
  'vote_average.gte'?: number;
  'vote_average.lte'?: number;
  with_keywords?: string;
}

// ── Service ──────────────────────────────────────────────────────

export class TMDBService {
  private token: string;
  private language: string;

  constructor(token: string, language = 'en-US') {
    if (!token) {
      throw new Error('TMDB API Read Access Token is required');
    }
    this.token = token;
    this.language = language;
  }

  // ── Core Request ───────────────────────────────────────────────

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('language', this.language);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
    });

    if (response.status === 429) {
      // Rate limited — wait and retry once
      const retryAfter = response.headers.get('Retry-After') || '1';
      await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000));
      return this.request<T>(endpoint, params);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TMDB API error ${response.status}: ${body || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // ── Search ─────────────────────────────────────────────────────

  async searchMulti(query: string, page = 1): Promise<TMDBSearchResponse<TMDBTrendingItem>> {
    return this.request('/search/multi', { query, page, include_adult: 'false' });
  }

  async searchMovies(query: string, page = 1): Promise<TMDBSearchResponse<TMDBMovieResult>> {
    return this.request('/search/movie', { query, page, include_adult: 'false' });
  }

  async searchTV(query: string, page = 1): Promise<TMDBSearchResponse<TVResult>> {
    return this.request('/search/tv', { query, page, include_adult: 'false' });
  }

  // ── Movie Details ──────────────────────────────────────────────

  async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
    return this.request(`/movie/${tmdbId}`, {
      append_to_response: 'videos,credits',
    });
  }

  // ── TV Details ─────────────────────────────────────────────────

  async getTVDetails(tmdbId: number): Promise<TMDBTVDetail> {
    return this.request(`/tv/${tmdbId}`, {
      append_to_response: 'videos,credits',
    });
  }

  // ── Trending ───────────────────────────────────────────────────

  async getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'day', page = 1) {
    return this.request<{ page: number; results: TMDBTrendingItem[]; total_results: number; total_pages: number }>(
      `/trending/${mediaType}/${timeWindow}`,
      { page }
    );
  }

  // ── Popular ────────────────────────────────────────────────────

  async getPopularMovies(page = 1): Promise<TMDBSearchResponse<TMDBMovieResult>> {
    return this.request('/movie/popular', { page });
  }

  async getPopularTV(page = 1): Promise<TMDBSearchResponse<TVResult>> {
    return this.request('/tv/popular', { page });
  }

  // ── Recommendations ────────────────────────────────────────────

  async getMovieRecommendations(tmdbId: number, page = 1): Promise<TMDBSearchResponse<TMDBMovieResult>> {
    return this.request(`/movie/${tmdbId}/recommendations`, { page });
  }

  async getTVRecommendations(tmdbId: number, page = 1): Promise<TMDBSearchResponse<TVResult>> {
    return this.request(`/tv/${tmdbId}/recommendations`, { page });
  }

  // ── Discover ───────────────────────────────────────────────────

  async discover(params: TMDBDiscoverParams): Promise<TMDBSearchResponse<TMDBMovieResult | TVResult>> {
    const { media_type, ...rest } = params;
    const endpoint = media_type === 'tv' ? '/discover/tv' : '/discover/movie';
    return this.request(endpoint, rest as Record<string, string | number>);
  }

  // ── Genre List ─────────────────────────────────────────────────

  async getMovieGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.request('/genre/movie/list');
  }

  async getTVGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.request('/genre/tv/list');
  }

  // ── Image Helpers ──────────────────────────────────────────────

  static imageUrl(path: string | null, size: string = 'w500'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }

  static posterUrl(path: string | null, size: TMDBImageSize = 'md'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${TMDB_IMAGE_SIZES.poster[size]}${path}`;
  }

  static backdropUrl(path: string | null, size: TMDBImageSize = 'md'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${TMDB_IMAGE_SIZES.backdrop[size]}${path}`;
  }

  static profileUrl(path: string | null, size: TMDBImageSize = 'sm'): string | null {
    if (!path) return null;
    const profileSize = size === 'lg' ? 'md' : size; // profile has no 'lg'
    return `${TMDB_IMAGE_BASE}/${TMDB_IMAGE_SIZES.profile[profileSize]}${path}`;
  }

  static stillUrl(path: string | null, size: TMDBImageSize = 'sm'): string | null {
    if (!path) return null;
    const stillSize = size === 'lg' ? 'md' : size; // still has no 'lg'
    return `${TMDB_IMAGE_BASE}/${TMDB_IMAGE_SIZES.still[stillSize]}${path}`;
  }
}

// ── Factory ──────────────────────────────────────────────────────

let tmdbInstance: TMDBService | null = null;

export function getTMDB(token: string): TMDBService {
  if (!tmdbInstance) {
    tmdbInstance = new TMDBService(token);
  }
  return tmdbInstance;
}

// ── Image URL Helper (for frontend use) ──────────────────────────
// These don't require the token — they just construct URLs

export const tmdbImage = {
  poster: (path: string | null, size: TMDBImageSize = 'md') => TMDBService.posterUrl(path, size),
  backdrop: (path: string | null, size: TMDBImageSize = 'md') => TMDBService.backdropUrl(path, size),
  profile: (path: string | null, size: TMDBImageSize = 'sm') => TMDBService.profileUrl(path, size),
  still: (path: string | null, size: TMDBImageSize = 'sm') => TMDBService.stillUrl(path, size),
};
