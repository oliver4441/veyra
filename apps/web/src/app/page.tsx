'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import DiscoveryRow from '@/components/DiscoveryRow';
import { SkeletonRow } from '@/components/SkeletonCard';
import { api, type Movie, type DiscoveryItem } from '@/lib/api';

const mockFeatured: Movie = {
  id: 1,
  title: 'The Midnight Echo',
  slug: 'the-midnight-echo',
  description: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  shortDescription: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  type: 'movie',
  year: 2024,
  duration: 8100,
  rating: 'PG-13',
  imdbRating: 8.5,
  posterUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBMS5FpDB_NWOdcXFGMSssfzF8uhI6i8xJLMkZCU6UTuuRONadJatwkeFkU4EKacHfPmha_EoWKWGD-6AZ11eWW3VkaGiWm2QzJO7h9lSiCL0ZH7wmDiypFB6e4VvgmCfuRsKwRHXO6aqDD6wwHPIuv1rrs70qM04xkIZYQh4pPRQk9IBgEaOUO7kpaUPTmoIi4D-xd2IPwsRicE01AlOVSptaMh0B4q0cznQCYX6Q-LUpAssJCHDDYSQ',
  backdropUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABODfiptbwu9_rVVuwS2TlIp6wjnfupyfryIBMoGqxkkhv6tcA7Vock7HHXA-ABswHuv3sJWjyxVdOrOdqRzGmkGqjlYAwU1F5ba6LKeztzS3G1BHmAt0WOO_BybCsOqvXhzjEJGasAqdDEYLs1t0Wg6C8luaw6mPWBMi3A1HgoZnup6_67mOXLHCR58rlyNOG8v_BrRl7ScWQXi4ORk5NMDSCy1-SYG-CJPp9bYElFGwnSkaD9GjBSg',
  genres: [{ id: 1, name: 'Sci-Fi', slug: 'sci-fi' }, { id: 2, name: 'Thriller', slug: 'thriller' }],
  status: 'published',
  featured: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface ContinueWatchingItem {
  movieId: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
}

export default function HomePage() {
  const [featured, setFeatured] = useState<Movie>(mockFeatured);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const [tmdbTrending, setTmdbTrending] = useState<DiscoveryItem[]>([]);
  const [tmdbPopularMovies, setTmdbPopularMovies] = useState<DiscoveryItem[]>([]);
  const [tmdbPopularTV, setTmdbPopularTV] = useState<DiscoveryItem[]>([]);

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, trendingRes, moviesRes] = await Promise.allSettled([
          api.getFeaturedMovies(),
          api.getTrendingMovies(10),
          api.getMovies({ limit: 10 }),
        ]);

        if (featuredRes.status === 'fulfilled' && featuredRes.value.movies.length > 0) {
          setFeatured(featuredRes.value.movies[0]);
        }
        if (trendingRes.status === 'fulfilled') setTrending(trendingRes.value.movies);
        if (moviesRes.status === 'fulfilled') setRecentlyAdded(moviesRes.value.movies);
      } catch {
        // Use mock data
      }
    };

    const fetchDiscovery = async () => {
      try {
        const [trendingRes, popularMoviesRes, popularTVRes] = await Promise.allSettled([
          api.getTrending('day'),
          api.getPopular('movie'),
          api.getPopular('tv'),
        ]);

        if (trendingRes.status === 'fulfilled') setTmdbTrending(trendingRes.value.results);
        if (popularMoviesRes.status === 'fulfilled') setTmdbPopularMovies(popularMoviesRes.value.results);
        if (popularTVRes.status === 'fulfilled') setTmdbPopularTV(popularTVRes.value.results);
      } catch {
        // TMDB unavailable
      }
    };

    const fetchContinueWatching = async () => {
      try {
        await api.getMe();
        const { progress } = await api.getWatchProgress();
        const incomplete = progress
          .filter((p) => !p.completed && p.movieId)
          .reduce<ContinueWatchingItem[]>((acc, p) => {
            if (!acc.find((a) => a.movieId === p.movieId)) {
              acc.push({
                movieId: p.movieId!,
                position: p.position,
                duration: p.duration,
                completed: p.completed,
                updatedAt: p.updatedAt,
              });
            }
            return acc;
          }, [])
          .slice(0, 6);

        if (incomplete.length > 0) {
          const movies = await Promise.allSettled(
            incomplete.map(async (item) => {
              const allMovies = await api.getMovies({ limit: 50 });
              const movie = allMovies.movies.find((m) => m.id === item.movieId);
              return { ...item, movie: movie || undefined };
            })
          );
          setContinueWatching(
            movies
              .filter(
                (m): m is PromiseFulfilledResult<
                  Omit<ContinueWatchingItem, 'movie'> & { movie: Movie | undefined }
                > => m.status === 'fulfilled'
              )
              .map((m) => m.value)
          );
        }
      } catch {
        // Not authenticated or API error
      }
    };

    fetchData();
    fetchDiscovery();
    fetchContinueWatching();
    setLoading(false);
  }, []);

  const formatRemaining = (position: number, duration: number) => {
    const remaining = duration - position;
    if (remaining <= 0) return 'Complete';
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <Hero movie={featured} />

      {/* Content Rows */}
      <main className="relative z-20 -mt-24 pb-32">
        <div className="pl-5 md:pl-16 pr-4 md:pr-16">

          {/* ── TMDB Trending Today ───────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbTrending.length > 0 ? (
            <DiscoveryRow title="Trending Today" items={tmdbTrending} size="md" />
          ) : null}

          {/* ── Continue Watching ─────────────────────────────── */}
          {continueWatching.length > 0 && (
            <section className="mb-12 md:mb-16">
              <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold mb-5">
                Continue Watching
              </h2>
              <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory">
                {continueWatching.map((item) => {
                  const progressPct =
                    item.duration > 0
                      ? Math.min((item.position / item.duration) * 100, 100)
                      : 0;
                  return (
                    <a
                      key={item.movieId}
                      href={`/movie/${item.movie?.slug || item.movieId}`}
                      className="group min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] snap-start flex-shrink-0"
                    >
                      <div className="relative h-44 rounded-xl overflow-hidden bg-surface-container">
                        {item.movie?.backdropUrl ? (
                          <img
                            src={item.movie.backdropUrl}
                            alt={item.movie.title}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container" />
                        )}

                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                            <span className="text-white text-lg ml-0.5">▶</span>
                          </div>
                        </div>

                        {/* Progress bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="px-1 pt-3">
                        <h3 className="text-white font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {item.movie?.title || 'Unknown'}
                        </h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-on-surface-variant text-xs">
                            {formatDuration(item.movie?.duration)}
                          </span>
                          <span className="text-on-surface-variant text-xs">
                            {formatRemaining(item.position, item.duration)}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Trending Now ─────────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-40 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : trending.length > 0 ? (
            <MovieRow title="Trending Now" movies={trending} size="md" />
          ) : null}

          {/* ── Recently Added ───────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : recentlyAdded.length > 0 ? (
            <MovieRow title="Recently Added" movies={recentlyAdded} size="md" />
          ) : null}

          {/* ── TMDB Popular Movies ──────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-44 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbPopularMovies.length > 0 ? (
            <DiscoveryRow title="Popular Movies" items={tmdbPopularMovies} size="md" />
          ) : null}

          {/* ── TMDB Popular TV ──────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-48 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} variant="backdrop" />
            </section>
          ) : tmdbPopularTV.length > 0 ? (
            <DiscoveryRow title="Popular TV Shows" items={tmdbPopularTV} size="md" />
          ) : null}

        </div>
      </main>
    </div>
  );
}
