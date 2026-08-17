'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { api, type Movie, type DiscoveryItem } from '@/lib/api';

export default function AdminMoviesPage() {
  const [tab, setTab] = useState<'tmdb' | 'local'>('tmdb');

  // TMDB search state
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbMediaType, setTmdbMediaType] = useState('multi');
  const [tmdbResults, setTmdbResults] = useState<DiscoveryItem[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState('');

  // Import state
  const [importing, setImporting] = useState<number | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedMap, setImportedMap] = useState<Record<number, boolean>>({});

  const handleTMDBSearch = useCallback(async () => {
    if (!tmdbQuery.trim()) return;
    setTmdbLoading(true);
    setTmdbError('');
    setImportSuccess(null);
    setImportError(null);

    try {
      const result = await api.adminSearchTMDB(tmdbQuery, tmdbMediaType);
      setTmdbResults(result.results);

      // Check which are already imported
      for (const item of result.results) {
        try {
          const check = await api.adminCheckTMDB(item.tmdbId, item.mediaType);
          if (check.imported) {
            setImportedMap((prev) => ({ ...prev, [item.tmdbId]: true }));
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setTmdbError(err.message || 'Search failed');
    } finally {
      setTmdbLoading(false);
    }
  }, [tmdbQuery, tmdbMediaType]);

  const handleImport = useCallback(async (item: DiscoveryItem) => {
    setImporting(item.tmdbId);
    setImportSuccess(null);
    setImportError(null);

    try {
      const result = await api.adminImportTMDB(item.tmdbId, item.mediaType);
      setImportSuccess(`Imported "${item.title}" successfully!`);
      setImportedMap((prev) => ({ ...prev, [item.tmdbId]: true }));
    } catch (err: any) {
      const msg = err.message || 'Import failed';
      if (msg.includes('Already imported')) {
        setImportError(`"${item.title}" is already imported.`);
        setImportedMap((prev) => ({ ...prev, [item.tmdbId]: true }));
      } else {
        setImportError(msg);
      }
    } finally {
      setImporting(null);
    }
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Movie Management</h1>
          <p className="text-on-surface-variant">
            Search TMDB and import metadata into Veyra.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('tmdb')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'tmdb'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-white'
            }`}
          >
            TMDB Import
          </button>
          <button
            onClick={() => setTab('local')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'local'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-white'
            }`}
          >
            Local Catalog
          </button>
        </div>

        {/* Status Messages */}
        {importSuccess && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {importSuccess}
          </div>
        )}
        {importError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {importError}
          </div>
        )}

        {/* ── TMDB Tab ──────────────────────────────────────────── */}
        {tab === 'tmdb' && (
          <div>
            {/* Search Bar */}
            <div className="flex gap-3 mb-6">
              <select
                value={tmdbMediaType}
                onChange={(e) => setTmdbMediaType(e.target.value)}
                className="px-3 py-2 bg-surface-container border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="multi">All</option>
                <option value="movie">Movies</option>
                <option value="tv">TV Shows</option>
              </select>
              <input
                type="text"
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTMDBSearch()}
                placeholder="Search TMDB for movies and TV shows..."
                className="flex-1 px-4 py-2 bg-surface-container border border-white/10 rounded-lg text-white placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleTMDBSearch}
                disabled={tmdbLoading || !tmdbQuery.trim()}
                className="px-6 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {tmdbLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {tmdbError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {tmdbError}
              </div>
            )}

            {/* Results Grid */}
            {tmdbResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tmdbResults.map((item) => (
                  <TMDBResultCard
                    key={`${item.tmdbId}-${item.mediaType}`}
                    item={item}
                    isImported={!!importedMap[item.tmdbId]}
                    isImporting={importing === item.tmdbId}
                    onImport={() => handleImport(item)}
                  />
                ))}
              </div>
            )}

            {!tmdbLoading && tmdbResults.length === 0 && tmdbQuery && !tmdbError && (
              <div className="text-center py-16 text-on-surface-variant">
                No results found for &quot;{tmdbQuery}&quot;
              </div>
            )}
          </div>
        )}

        {/* ── Local Tab ─────────────────────────────────────────── */}
        {tab === 'local' && (
          <div>
            <p className="text-on-surface-variant text-sm mb-4">
              Movies in your Veyra catalog. Use &quot;Refresh Metadata&quot; to update from TMDB.
            </p>
            <LocalMoviesList />
          </div>
        )}
      </div>
    </div>
  );
}

// ── TMDB Result Card ─────────────────────────────────────────────

function TMDBResultCard({
  item,
  isImported,
  isImporting,
  onImport,
}: {
  item: DiscoveryItem;
  isImported: boolean;
  isImporting: boolean;
  onImport: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-container rounded-xl border border-white/5 overflow-hidden">
      {/* Poster + Backdrop */}
      <div className="relative h-48 bg-surface">
        {item.backdropPath ? (
          <img
            src={item.backdropUrl || `https://image.tmdb.org/t/p/w780${item.backdropPath}`}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
            No Image
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-black/70 text-white text-xs rounded-full font-medium">
            {item.mediaType === 'tv' ? 'TV' : 'Movie'}
          </span>
        </div>
        {item.voteAverage ? (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 bg-black/70 text-yellow-400 text-xs rounded-full font-medium">
              ★ {item.voteAverage.toFixed(1)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-semibold text-sm mb-1 line-clamp-1">{item.title}</h3>
        {item.originalTitle && item.originalTitle !== item.title && (
          <p className="text-on-surface-variant text-xs mb-1 line-clamp-1 italic">
            {item.originalTitle}
          </p>
        )}
        <p className="text-on-surface-variant text-xs mb-2">
          {item.releaseDate?.substring(0, 4) || 'N/A'}
          {item.originalLanguage ? ` · ${item.originalLanguage.toUpperCase()}` : ''}
        </p>

        {/* Expand/Collapse Overview */}
        {item.overview && (
          <div className="mb-3">
            <p className={`text-on-surface-variant text-xs leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {item.overview}
            </p>
            {item.overview.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-primary text-xs mt-1"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Import Button */}
        <button
          onClick={onImport}
          disabled={isImported || isImporting}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
            isImported
              ? 'bg-green-500/10 text-green-400 cursor-default'
              : isImporting
              ? 'bg-primary/50 text-white cursor-wait'
              : 'bg-primary text-on-primary hover:bg-primary/90'
          }`}
        >
          {isImported ? '✓ Imported' : isImporting ? 'Importing...' : 'Import to Veyra'}
        </button>
      </div>
    </div>
  );
}

// ── Local Movies List ────────────────────────────────────────────

function LocalMoviesList() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState<number | null>(null);

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.request<{ movies: Movie[]; pagination: any }>('/api/admin/movies?limit=100');
      setMovies(result.movies);
    } catch (err: any) {
      setError(err.message || 'Failed to load movies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleRefresh = useCallback(async (movieId: number) => {
    setRefreshing(movieId);
    try {
      await api.adminRefreshTMDB(movieId);
      // Re-fetch list to show updated metadata
      fetchMovies();
    } catch (err: any) {
      setError(err.message || 'Refresh failed');
    } finally {
      setRefreshing(null);
    }
  }, [fetchMovies]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-surface-container rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {movies.map((movie) => (
        <div
          key={movie.id}
          className="flex items-center gap-4 p-3 bg-surface-container rounded-lg border border-white/5"
        >
          {/* Poster thumbnail */}
          <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-surface">
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs">
                N/A
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-semibold truncate">{movie.title}</h3>
            <p className="text-on-surface-variant text-xs">
              {movie.year || 'N/A'} · {movie.type}
              {movie.tmdbId ? ` · TMDB #${movie.tmdbId}` : ''}
            </p>
          </div>

          {/* Status */}
          <span
            className={`px-2 py-1 text-xs rounded-full font-medium ${
              movie.status === 'published'
                ? 'bg-green-500/10 text-green-400'
                : movie.status === 'draft'
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-surface-variant text-on-surface-variant'
            }`}
          >
            {movie.status}
          </span>

          {/* Refresh button (only for TMDB-linked) */}
          {movie.tmdbId && (
            <button
              onClick={() => handleRefresh(movie.id)}
              disabled={refreshing === movie.id}
              className="px-3 py-1 bg-surface-variant text-on-surface-variant text-xs rounded-lg hover:text-white transition-all disabled:opacity-50"
              title="Refresh metadata from TMDB"
            >
              {refreshing === movie.id ? '...' : '↻ Refresh'}
            </button>
          )}
        </div>
      ))}

      {movies.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          No movies in catalog. Use &quot;TMDB Import&quot; tab to add some.
        </div>
      )}
    </div>
  );
}
