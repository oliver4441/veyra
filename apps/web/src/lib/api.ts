import { cacheResponse, getCachedResponse, getQueuedRequests, queueRequest, removeQueuedRequest } from './offline-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

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
  createdAt: string;
  updatedAt: string;
}

interface Genre { id: number; name: string; slug: string; }
interface SeriesInfo { id: number; movieId: number; totalSeasons: number; totalEpisodes: number; status: string; }
interface Season { id: number; seriesId: number; seasonNumber: number; title?: string; description?: string; episodes?: Episode[]; }
interface Episode { id: number; seasonId: number; episodeNumber: number; title: string; description?: string; duration?: number; thumbnailUrl?: string; }
interface MediaFile { id: number; movieId?: number; episodeId?: number; storageProvider: string; quality?: string; streamingEnabled: boolean; downloadEnabled: boolean; }
interface User { id: number; email: string; username: string; displayName?: string; avatarUrl?: string; role: string; }
interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface WatchProgress { id: number; movieId?: number; episodeId?: number; position: number; duration: number; completed: boolean; updatedAt: string; }

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) { this.baseUrl = baseUrl; }

  setAccessToken(token: string | null) { this.accessToken = token; }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json() as T;
      if (method === 'GET' && typeof window !== 'undefined') {
        await cacheResponse(url, result);
      }
      return result;
    } catch (error) {
      // GET requests can transparently fall back to the most recent cached API response.
      if (method === 'GET' && typeof window !== 'undefined') {
        const cached = await getCachedResponse<T>(url);
        if (cached !== null) return cached;
      }
      throw error;
    }
  }

  async flushOfflineQueue() {
    if (typeof window === 'undefined' || !navigator.onLine || !this.accessToken) return;

    const queued = await getQueuedRequests();
    for (const item of queued) {
      try {
        await this.request(item.endpoint, {
          method: item.method,
          body: item.body,
        });
        await removeQueuedRequest(item.id);
      } catch {
        // Keep the request queued; a later online event can retry it.
      }
    }
  }

  async register(data: { email: string; username: string; password: string; displayName?: string; }) {
    const result = await this.request<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    });
    this.accessToken = result.accessToken;
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.request<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    this.accessToken = result.accessToken;
    return result;
  }

  async getMe() { return this.request<{ user: User }>('/api/auth/me'); }

  async getMovies(params?: { page?: number; limit?: number; genre?: number; type?: string; }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.genre) searchParams.set('genre', String(params.genre));
    if (params?.type) searchParams.set('type', params.type);
    const query = searchParams.toString();
    return this.request<{ movies: Movie[]; pagination: Pagination }>(`/api/movies${query ? `?${query}` : ''}`);
  }

  async getFeaturedMovies() { return this.request<{ movies: Movie[] }>('/api/movies/featured'); }
  async getTrendingMovies(limit = 10) { return this.request<{ movies: Movie[] }>(`/api/movies/trending?limit=${limit}`); }
  async getMovie(slug: string) { return this.request<{ movie: Movie }>(`/api/movies/${slug}`); }

  async search(query: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    return this.request<{ results: Movie[]; query: string; pagination: Pagination }>(`/api/search?${searchParams.toString()}`);
  }

  async getSearchSuggestions(query: string) {
    return this.request<{ suggestions: Movie[] }>(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
  }

  async getGenres() { return this.request<{ genres: Genre[] }>('/api/genres'); }
  async getWatchProgress() { return this.request<{ progress: WatchProgress[] }>('/api/watch/progress'); }

  async updateWatchProgress(data: { movieId?: number; episodeId?: number; position: number; duration: number; }) {
    try {
      return await this.request<{ success: boolean }>('/api/watch/progress', {
        method: 'POST', body: JSON.stringify(data),
      });
    } catch (error) {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        await queueRequest({ endpoint: '/api/watch/progress', method: 'POST', body: JSON.stringify(data) });
        return { success: true };
      }
      throw error;
    }
  }

  async getStreamingUrl(movieId: number, quality = '1080') {
    return this.request<{ movieId: number; quality: string; streamingUrl: string; expiresAt: string }>(`/api/watch/streaming-url/${movieId}?quality=${quality}`);
  }

  async getWatchlist() {
    return this.request<{ watchlist: Array<{ id: number; addedAt: string; movie: Movie }> }>('/api/watch/watchlist');
  }

  async addToWatchlist(movieId: number) {
    return this.request<{ success: boolean }>('/api/watch/watchlist', { method: 'POST', body: JSON.stringify({ movieId }) });
  }

  async removeFromWatchlist(movieId: number) {
    return this.request<{ success: boolean }>(`/api/watch/watchlist/${movieId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
export type { Movie, Genre, Season, Episode, User, WatchProgress, Pagination };
