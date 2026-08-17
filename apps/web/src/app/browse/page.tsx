'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { api, type Movie, type Genre } from '@/lib/api';

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const type = searchParams.get('type') || '';
  const genreParam = searchParams.get('genre') || '';

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`/browse${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMovies({
        limit: 60,
        type: type || undefined,
        genre: genreParam ? parseInt(genreParam, 10) : undefined,
      });
      setMovies(res.movies);
      setTotal(res.pagination.total);
    } catch {
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [type, genreParam]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  useEffect(() => {
    api.getGenres().then((res) => setGenres(res.genres)).catch(() => {});
  }, []);

  const activeGenre = genreParam ? parseInt(genreParam, 10) : null;

  const typeFilters = [
    { value: '', label: 'All' },
    { value: 'movie', label: 'Movies' },
    { value: 'series', label: 'Series' },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline-md text-3xl md:text-4xl text-white mb-2">
            {type === 'series' ? 'Series' : type === 'movie' ? 'Movies' : 'Browse'}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {loading ? (
              <span className="inline-block w-32 h-4 bg-surface-container rounded animate-pulse" />
            ) : (
              <>
                {total} title{total === 1 ? '' : 's'}
                {activeGenre
                  ? ` in ${genres.find((g) => g.id === activeGenre)?.name || 'this genre'}`
                  : ''}
              </>
            )}
          </p>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-1">
          {typeFilters.map((t) => (
            <button
              key={t.value}
              onClick={() => updateParam('type', t.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                type === t.value
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-container text-on-surface-variant hover:text-white hover:bg-surface-container-high'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Genre filter */}
        <div className="flex gap-2 mb-10 flex-wrap">
          <button
            onClick={() => updateParam('genre', '')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              !activeGenre
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-white hover:bg-surface-container-high'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => updateParam('genre', String(g.id))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activeGenre === g.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:text-white hover:bg-surface-container-high'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonGrid count={10} size="sm" />
        ) : movies.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} size="sm" />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <span className="text-5xl block mb-4">🎬</span>
            <h2 className="font-headline-md text-xl text-white mb-2">No titles found</h2>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto">
              Try adjusting your filters or browse all titles to discover something new.
            </p>
            <button
              onClick={() => {
                router.replace('/browse');
              }}
              className="mt-6 px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
