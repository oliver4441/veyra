'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { Search as SearchIcon, X } from 'lucide-react';
import { api, type Movie } from '@/lib/api';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.search(searchQuery, { limit: 20 });
      setResults(data.results);
      setSearched(true);
    } catch {
      // If API fails, show empty results
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const data = await api.getSearchSuggestions(q);
      setSuggestions(data.suggestions);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery, handleSearch]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (query) {
        handleSuggestions(query);
      }
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, handleSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
    setSuggestions([]);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        {/* Search Input */}
        <div className="max-w-2xl mx-auto mb-12">
          <form onSubmit={handleSubmit} className="relative">
            <SearchIcon
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, series, genres..."
              className="input-field pl-12 pr-12 py-4 text-lg"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSuggestions([]);
                  setSearched(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </form>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 glass-panel rounded-lg overflow-hidden z-50 max-w-2xl mx-auto">
              {suggestions.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => {
                    setQuery(movie.title);
                    handleSearch(movie.title);
                    setSuggestions([]);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                >
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-10 h-14 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-surface-container rounded flex items-center justify-center">
                      🎬
                    </div>
                  )}
                  <div>
                    <div className="text-white font-semibold">{movie.title}</div>
                    <div className="text-on-surface-variant text-sm">
                      {movie.year} • {movie.type === 'series' ? 'Series' : 'Movie'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div>
            <p className="text-on-surface-variant mb-6">
              {results.length > 0
                ? `Found ${results.length} results for "${query}"`
                : `No results found for "${query}"`}
            </p>

            {results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {results.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} size="sm" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !searched && (
          <div className="text-center py-24">
            <SearchIcon size={64} className="mx-auto mb-6 text-surface-variant" />
            <h2 className="font-headline-md text-2xl text-white mb-2">
              Search Veyra
            </h2>
            <p className="text-on-surface-variant">
              Find your favorite movies, series, and genres
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
