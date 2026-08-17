'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { Search as SearchIcon, X, TrendingUp, Film } from 'lucide-react';
import { api, type Movie } from '@/lib/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    try {
      const data = await api.search(searchQuery, { limit: 20 });
      setResults(data.results);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const data = await api.getSearchSuggestions(q);
      setSuggestions(data.suggestions);
      setShowSuggestions(data.suggestions.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
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
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, handleSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
    setShowSuggestions(false);
  };

  const selectSuggestion = (movie: Movie) => {
    setQuery(movie.title);
    handleSearch(movie.title);
    setShowSuggestions(false);
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
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search for movies, series, genres..."
              className="w-full pl-12 pr-12 py-4 bg-surface-container border border-white/10 rounded-xl text-white text-lg placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200"
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
                  setShowSuggestions(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="relative mt-2 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
              {suggestions.map((movie, i) => (
                <button
                  key={movie.id}
                  onClick={() => selectSuggestion(movie)}
                  className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                    i !== suggestions.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-10 h-14 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-surface-container rounded-lg flex items-center justify-center">
                      <Film size={16} className="text-on-surface-variant" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm truncate">{movie.title}</div>
                    <div className="text-on-surface-variant text-xs mt-0.5">
                      {movie.year || 'N/A'} · {movie.type === 'series' ? 'Series' : 'Movie'}
                      {movie.imdbRating && (
                        <span className="text-yellow-400 ml-2">⭐ {movie.imdbRating}</span>
                      )}
                    </div>
                  </div>
                  <SearchIcon size={14} className="text-on-surface-variant shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="max-w-[1200px] mx-auto">
            <SkeletonGrid count={10} size="sm" />
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div>
            <p className="text-on-surface-variant mb-6 text-sm">
              {results.length > 0 ? (
                <>
                  Found <span className="text-white font-medium">{results.length}</span> result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
                </>
              ) : (
                <>
                  No results found for &quot;<span className="text-white">{query}</span>&quot;
                </>
              )}
            </p>

            {results.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {results.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} size="sm" />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">🔍</span>
                <h2 className="font-headline-md text-xl text-white mb-2">No results found</h2>
                <p className="text-on-surface-variant text-sm max-w-md mx-auto">
                  Try searching with different keywords or check the spelling.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State — initial */}
        {!loading && !searched && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
              <SearchIcon size={32} className="text-on-surface-variant" />
            </div>
            <h2 className="font-headline-md text-2xl text-white mb-2">
              Search Veyra
            </h2>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">
              Find your favorite movies, series, and genres across our catalog.
            </p>

            {/* Quick suggestions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-on-surface-variant text-xs mr-1">Try:</span>
              {['Action', 'Sci-Fi', 'Comedy', 'Drama', 'Horror'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setQuery(tag);
                    handleSearch(tag);
                  }}
                  className="px-3 py-1.5 bg-surface-container text-on-surface-variant text-xs font-medium rounded-full hover:text-white hover:bg-surface-container-high transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
