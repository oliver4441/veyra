const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// When true (default in dev), any API failure falls back to the in-browser
// mock backend so the frontend works end-to-end without the real API.
const MOCK_FALLBACK = process.env.NEXT_PUBLIC_MOCK_API !== 'false';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface Movie {
  id: number;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  type: 'movie' | 'series';
  year?: number;
  duration?: number;
  rating?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  tags?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  status: string;
  featured?: boolean;
  trending?: boolean;
  viewCount?: number;
  availableQualities?: string[];
  genres?: Genre[];
  series?: SeriesInfo;
  seasons?: Season[];
  mediaFiles?: MediaFile[];
  // TMDB fields
  tmdbId?: number;
  tmdbMediaType?: string;
  originalTitle?: string;
  originalLanguage?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  posterPath?: string;
  backdropPath?: string;
  productionCountries?: string[];
  spokenLanguages?: string[];
  statusTmdb?: string;
  metadataUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Genre {
  id: number;
  name: string;
  slug: string;
}

interface SeriesInfo {
  id: number;
  movieId: number;
  totalSeasons: number;
  totalEpisodes: number;
  status: string;
}

interface Season {
  id: number;
  seriesId: number;
  seasonNumber: number;
  title?: string;
  description?: string;
  episodes?: Episode[];
}

interface Episode {
  id: number;
  seasonId: number;
  episodeNumber: number;
  title: string;
  description?: string;
  duration?: number;
  thumbnailUrl?: string;
}

interface MediaFile {
  id: number;
  movieId?: number;
  episodeId?: number;
  storageProvider: string;
  quality?: string;
  streamingEnabled: boolean;
  downloadEnabled: boolean;
}

interface User {
  id: number;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface WatchProgress {
  id: number;
  movieId?: number;
  episodeId?: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private mockWarned = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Restore persisted session token so refresh keeps you signed in
    if (typeof window !== 'undefined') {
      try {
        this.accessToken = window.localStorage.getItem('veyra-access-token');
      } catch {
        // ignore
      }
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.localStorage.setItem('veyra-access-token', token);
        } else {
          window.localStorage.removeItem('veyra-access-token');
        }
      } catch {
        // ignore
      }
    }
  }

  isMockFallback() {
    return MOCK_FALLBACK;
  }

  // Public request method for use by other services
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!MOCK_FALLBACK) {
      return this.realRequest<T>(endpoint, options);
    }

    try {
      return await this.realRequest<T>(endpoint, options);
    } catch (err) {
      // Fall back to the in-browser mock backend on any failure.
      if (!this.mockWarned) {
        console.warn(
          '[Veyra] API unreachable — falling back to in-browser mock data. ' +
            'Set NEXT_PUBLIC_MOCK_API=false to disable.',
          err
        );
        this.mockWarned = true;
      }
      const { mockRequest } = await import('@/lib/mock/api');
      const { body, headers, ...rest } = options as any;
      return mockRequest(endpoint, {
        method: rest.method,
        body: body instanceof FormData ? body : body ? JSON.parse(body) : undefined,
      });
    }
  }

  private async realRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async register(data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) {
    const result = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.accessToken = result.accessToken;
    return result;
  }

  async logout() {
    try {
      await this.request<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // ignore
    }
    this.setAccessToken(null);
  }

  async login(email: string, password: string) {
    const result = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.accessToken = result.accessToken;
    return result;
  }

  async getMe() {
    return this.request<{ user: User }>('/api/auth/me');
  }

  // Movies
  async getMovies(params?: {
    page?: number;
    limit?: number;
    genre?: number;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.genre) searchParams.set('genre', String(params.genre));
    if (params?.type) searchParams.set('type', params.type);

    const query = searchParams.toString();
    return this.request<{ movies: Movie[]; pagination: Pagination }>(
      `/api/movies${query ? `?${query}` : ''}`
    );
  }

  async getFeaturedMovies() {
    return this.request<{ movies: Movie[] }>('/api/movies/featured');
  }

  async getTrendingMovies(limit = 10) {
    return this.request<{ movies: Movie[] }>(`/api/movies/trending?limit=${limit}`);
  }

  async getMovie(slug: string) {
    return this.request<{ movie: Movie }>(`/api/movies/${slug}`);
  }

  // Search
  async search(query: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    return this.request<{
      results: Movie[];
      query: string;
      pagination: Pagination;
    }>(`/api/search?${searchParams.toString()}`);
  }

  async getSearchSuggestions(query: string) {
    return this.request<{ suggestions: Movie[] }>(
      `/api/search/suggestions?q=${encodeURIComponent(query)}`
    );
  }

  // Genres
  async getGenres() {
    return this.request<{ genres: Genre[] }>('/api/genres');
  }

  // Watch
  async getWatchProgress() {
    return this.request<{ progress: WatchProgress[] }>('/api/watch/progress');
  }

  async updateWatchProgress(data: {
    movieId?: number;
    episodeId?: number;
    position: number;
    duration: number;
  }) {
    return this.request<{ success: boolean }>('/api/watch/progress', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWatchHistory() {
    return this.request<{
      history: Array<{
        id: number;
        movieId: number;
        episodeId?: number;
        watchedAt: string;
        progress: number;
        movie: Movie;
      }>;
    }>('/api/watch/history');
  }

  async getStreamingUrl(movieId: number, quality = '1080') {
    return this.request<{
      movieId: number;
      quality: string;
      streamingUrl: string;
      expiresAt: string;
    }>(`/api/watch/streaming-url/${movieId}?quality=${quality}`);
  }

  // Watchlist
  async getWatchlist() {
    return this.request<{
      watchlist: Array<{ id: number; addedAt: string; movie: Movie }>;
    }>('/api/watch/watchlist');
  }

  async addToWatchlist(movieId: number) {
    return this.request<{ success: boolean }>('/api/watch/watchlist', {
      method: 'POST',
      body: JSON.stringify({ movieId }),
    });
  }

  async removeFromWatchlist(movieId: number) {
    return this.request<{ success: boolean }>(
      `/api/watch/watchlist/${movieId}`,
      { method: 'DELETE' }
    );
  }

  // ── Offline Queue ──────────────────────────────────────────────

  async flushOfflineQueue() {
    try {
      const { getQueuedRequests, removeQueuedRequest } = await import('@/lib/offline-store');
      const queued = await getQueuedRequests();
      for (const req of queued) {
        try {
          await this.realRequest(req.endpoint, {
            method: req.method,
            body: req.body,
          });
          await removeQueuedRequest(req.id);
        } catch {
          // Keep in queue if still failing
        }
      }
    } catch {
      // offline-store unavailable
    }
  }

  // ── TMDB Discovery ──────────────────────────────────────────────

  async discoverySearch(query: string, params?: {
    page?: number;
    media_type?: string;
  }) {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.media_type) searchParams.set('media_type', params.media_type);
    return this.request<DiscoverySearchResult>(
      `/api/discovery/search?${searchParams.toString()}`
    );
  }

  async discoverySuggestions(query: string, limit = 8) {
    return this.request<{ suggestions: DiscoverySuggestion[] }>(
      `/api/discovery/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  async getTrending(timeWindow: 'day' | 'week' = 'day', page = 1) {
    return this.request<DiscoveryListResult>(
      `/api/discovery/trending?time_window=${timeWindow}&page=${page}`
    );
  }

  async getPopular(mediaType: 'movie' | 'tv' = 'movie', page = 1) {
    return this.request<DiscoveryListResult>(
      `/api/discovery/popular?media_type=${mediaType}&page=${page}`
    );
  }

  async getDiscoveryMovie(tmdbId: number) {
    return this.request<DiscoveryMovieDetail>(
      `/api/discovery/movie/${tmdbId}`
    );
  }

  async getDiscoveryTV(tmdbId: number) {
    return this.request<DiscoveryTVDetail>(
      `/api/discovery/tv/${tmdbId}`
    );
  }

  async getMovieRecommendations(tmdbId: number) {
    return this.request<{ results: DiscoveryItem[] }>(
      `/api/discovery/movie/${tmdbId}/recommendations`
    );
  }

  async getTVRecommendations(tmdbId: number) {
    return this.request<{ results: DiscoveryItem[] }>(
      `/api/discovery/tv/${tmdbId}/recommendations`
    );
  }

  async getDiscoveryGenres() {
    return this.request<{ genres: Array<{ id: number; name: string }> }>(
      '/api/discovery/genres'
    );
  }

  // ── Admin TMDB ──────────────────────────────────────────────────

  async adminSearchTMDB(query: string, mediaType = 'multi', page = 1) {
    return this.request<TMDBAdminSearchResult>(
      '/api/admin/tmdb/search',
      {
        method: 'POST',
        body: JSON.stringify({ query, mediaType, page }),
      }
    );
  }

  async adminImportTMDB(tmdbId: number, mediaType: string) {
    return this.request<TMDBImportResult>(
      '/api/admin/tmdb/import',
      {
        method: 'POST',
        body: JSON.stringify({ tmdbId, mediaType }),
      }
    );
  }

  async adminRefreshTMDB(movieId: number) {
    return this.request<{ success: boolean; refreshedAt: string }>(
      `/api/admin/tmdb/refresh/${movieId}`,
      { method: 'POST' }
    );
  }

  async adminCheckTMDB(tmdbId: number, mediaType = 'movie') {
    return this.request<{ imported: boolean; movie: Movie | null }>(
      `/api/admin/tmdb/check/${tmdbId}?media_type=${mediaType}`
    );
  }
}

// ── Discovery Types ──────────────────────────────────────────────

export interface DiscoveryItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  originalLanguage?: string;
  genreIds?: number[];
  posterPath?: string;
  backdropPath?: string;
  posterUrl?: string;
  backdropUrl?: string;
}

export interface DiscoverySearchResult {
  page: number;
  results: DiscoveryItem[];
  total_results?: number;
  total_pages?: number;
  query: string;
}

export interface DiscoveryListResult {
  page: number;
  results: DiscoveryItem[];
  totalPages?: number;
  totalResults?: number;
}

export interface DiscoverySuggestion {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath?: string;
  releaseDate?: string;
  voteAverage?: number;
}

export interface DiscoveryMovieDetail {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  runtime?: number;
  genres?: string[];
  productionCountries?: string[];
  spokenLanguages?: string[];
  status?: string;
  tagline?: string;
  originalLanguage?: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailer?: string;
  cast?: Array<{ name: string; character: string; profileUrl?: string }>;
  director?: string;
}

export interface DiscoveryTVDetail extends DiscoveryMovieDetail {
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: Array<{
    seasonNumber: number;
    name: string;
    overview?: string;
    posterPath?: string;
    airDate?: string;
    episodeCount?: number;
  }>;
}

export interface TMDBAdminSearchResult {
  results: Array<DiscoveryItem & { posterUrl?: string; backdropUrl?: string }>;
  query: string;
  page: number;
}

export interface TMDBImportResult {
  movie: Movie;
  tmdbId: number;
  mediaType: string;
  imported: boolean;
}

// Export singleton instance
export const api = new ApiClient(API_URL);
export type { Movie, Genre, Season, Episode, User, WatchProgress, Pagination };
