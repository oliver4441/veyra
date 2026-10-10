'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /search — one box, every source
// ─────────────────────────────────────────────────────────────────────────────
// A query fans out to the Veyra catalogue, the Internet Archive and (when an API
// key is configured) YouTube at the same time. Each provider reports its own
// outcome, so one being offline never blanks the page.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import SourceCard from '@/components/SourceCard';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { Search as SearchIcon, X, Film, AlertCircle, Download } from 'lucide-react';
import { api, type Movie } from '@/lib/api';
import {
  searchEverywhere,
  getSearchableSources,
  providerLabel,
  type AggregatedSearchResult,
} from '@/lib/sources/registry';
import type { SourceProviderId } from '@/lib/sources/types';

type Filter = 'all' | SourceProviderId;

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialSource = (searchParams.get('source') || 'all') as Filter;

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>(
    ['all', 'archive', 'youtube', 'external', 'veyra'].includes(initialSource) ? initialSource : 'all'
  );
  const [groups, setGroups] = useState<AggregatedSearchResult[]>([]);
  const [catalog, setCatalog] = useState<Movie[]>([]);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sources = useMemo(() => getSearchableSources(), []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setGroups([]);
      setCatalog([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    try {
      const results = await searchEverywhere(searchQuery, { limit: 24 });
      setGroups(results);
      setCatalog([]);
      setSearched(true);
    } catch {
      setGroups([]);
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
    if (initialQuery) handleSearch(initialQuery);
  }, [initialQuery, handleSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) handleSuggestions(query);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, handleSuggestions]);

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groups;
    return groups.filter((group) => group.provider === filter);
  }, [groups, filter]);

  const totalResults = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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
        {/* Search box */}
        <div className="max-w-2xl mx-auto mb-8">
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
              placeholder="Search free films, series and your library…"
              className="w-full pl-12 pr-12 py-4 bg-surface-container border border-white/10 rounded-xl text-white text-lg placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setGroups([]);
                  setSuggestions([]);
                  setSearched(false);
                  setShowSuggestions(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="relative mt-2 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 z-30">
              {suggestions.map((movie, i) => (
                <button
                  key={movie.id}
                  onClick={() => selectSuggestion(movie)}
                  className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                    i !== suggestions.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.title} className="w-10 h-14 object-cover rounded-lg" />
                  ) : (
                    <div className="w-10 h-14 bg-surface-container rounded-lg flex items-center justify-center">
                      <Film size={16} className="text-on-surface-variant" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm truncate">{movie.title}</div>
                    <div className="text-on-surface-variant text-xs mt-0.5">
                      {movie.year || 'N/A'} · {movie.type === 'series' ? 'Series' : 'Movie'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap mb-8">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All sources
          </FilterChip>
          <FilterChip active={filter === 'archive'} onClick={() => setFilter('archive')}>
            <span className="inline-flex items-center gap-1.5">
              Internet Archive <Download size={11} className="text-emerald-300" />
            </span>
          </FilterChip>
          <FilterChip active={filter === 'youtube'} onClick={() => setFilter('youtube')}>
            YouTube
          </FilterChip>
          <FilterChip active={filter === 'veyra'} onClick={() => setFilter('veyra')}>
            Your library
          </FilterChip>
        </div>

        {/* Loading */}
        {loading && (
          <div className="max-w-[1200px] mx-auto">
            <SkeletonGrid count={10} size="sm" />
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div>
            <p className="text-on-surface-variant mb-6 text-sm">
              {totalResults > 0 ? (
                <>
                  Found <span className="text-white font-medium">{totalResults}</span> result
                  {totalResults !== 1 ? 's' : ''} for &quot;{query}&quot;
                </>
              ) : (
                <>
                  No results for &quot;<span className="text-white">{query}</span>&quot;
                </>
              )}
            </p>

            {visibleGroups.map((group) => (
              <section key={group.provider} className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-headline-md text-base md:text-lg text-white font-semibold">
                    {group.provider === 'veyra' ? 'Your library' : providerLabel(group.provider)}
                    {group.items.length > 0 && (
                      <span className="text-on-surface-variant text-xs font-normal ml-2">
                        {group.items.length}
                        {group.provider === 'archive' && group.tookMs ? ` · ${(group.tookMs / 1000).toFixed(1)}s` : ''}
                      </span>
                    )}
                  </h2>
                </div>

                {group.error && group.items.length === 0 ? (
                  <div className="flex items-start gap-2.5 p-4 rounded-xl bg-surface-container/60 border border-white/5">
                    <AlertCircle size={15} className="text-yellow-300 shrink-0 mt-0.5" />
                    <p className="text-on-surface-variant text-xs leading-relaxed">{group.error}</p>
                  </div>
                ) : group.items.length === 0 ? (
                  <p className="text-on-surface-variant/60 text-xs">Nothing from this source.</p>
                ) : group.provider === 'veyra' ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {catalog.length > 0
                      ? catalog.map((movie) => <MovieCard key={movie.id} movie={movie} size="sm" />)
                      : group.items.map((item) => (
                          <SourceCard key={item.id} item={item} size="sm" showDownload={false} />
                        ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {group.items.map((item) => (
                      <SourceCard key={`${item.provider}:${item.id}`} item={item} size="sm" />
                    ))}
                  </div>
                )}
              </section>
            ))}

            {totalResults === 0 && visibleGroups.every((g) => !g.error) && (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">🔍</span>
                <h2 className="font-headline-md text-xl text-white mb-2">No results found</h2>
                <p className="text-on-surface-variant text-sm max-w-md mx-auto">
                  Try a different spelling, or search for a classic — the Internet Archive shelves are
                  deepest for films made before 1965.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !searched && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
              <SearchIcon size={32} className="text-on-surface-variant" />
            </div>
            <h2 className="font-headline-md text-2xl text-white mb-2">Search everywhere at once</h2>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-2">
              One query across the Internet Archive, YouTube and your own library. Archive results can
              be downloaded for offline watching.
            </p>
            <p className="text-on-surface-variant/70 text-xs max-w-md mx-auto">
              Active sources: {sources.map((s) => s.shortName).join(', ') || 'none configured'}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-on-surface-variant text-xs mr-1">Try:</span>
              {[
                'Nosferatu',
                'Night of the Living Dead',
                'Charade',
                'His Girl Friday',
                'Metropolis',
                'film noir',
              ].map((tag) => (
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

      <Footer />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-white/5 text-on-surface-variant border-white/10 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
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
