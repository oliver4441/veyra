'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import SourceHero from '@/components/SourceHero';
import MovieRow from '@/components/MovieRow';
import DiscoveryRow from '@/components/DiscoveryRow';
import SourceRow from '@/components/SourceRow';
import { SkeletonRow } from '@/components/SkeletonCard';
import { api, type Movie, type DiscoveryItem } from '@/lib/api';
import { curatedRows, type CuratedRow, type SourceItem } from '@/lib/sources/registry';
import { getAllProgress, subscribeGuestStore, type ProgressEntry } from '@/lib/mylist';

interface ContinueWatchingItem {
  movieId: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
}

const mockFeatured: Movie = {
  id: 1,
  title: 'The Midnight Echo',
  slug: 'the-midnight-echo',
  description:
    'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  shortDescription:
    'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  type: 'movie',
  year: 2024,
  duration: 8100,
  rating: 'PG-13',
  imdbRating: 8.5,
  genres: [
    { id: 1, name: 'Sci-Fi', slug: 'sci-fi' },
    { id: 2, name: 'Thriller', slug: 'thriller' },
  ],
  status: 'published',
  featured: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** One stable-but-rotating pick per day, so the billboard is never stale. */
function pickFeatured(items: SourceItem[]): SourceItem | null {
  const usable = items.filter((item) => item.title && item.title.length > 2);
  if (usable.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return usable[dayIndex % usable.length];
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

  // ── Free sources (archive.org, YouTube) ─────────────────────────────────
  const [rows, setRows] = useState<CuratedRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [resumes, setResumes] = useState<ProgressEntry[]>([]);

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
        // Catalogue is optional — the free sources carry the page.
      } finally {
        setLoading(false);
      }
    };

    const fetchDiscovery = async () => {
      try {
        const [trendingRes, popularMoviesRes, popularTVRes] = await Promise.allSettled([
          api.getTrending('day', 1),
          api.getPopular('movie', 1),
          api.getPopular('tv', 1),
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
        // No account needed — the API scopes progress by the device id header,
        // and the mock backend keeps it in localStorage.
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

        if (incomplete.length === 0) return;

        const allMovies = await api.getMovies({ limit: 50 });
        setContinueWatching(
          incomplete.map((item) => ({
            ...item,
            movie: allMovies.movies.find((m) => m.id === item.movieId),
          }))
        );
      } catch {
        // Device has no server-side progress yet
      }
    };

    const fetchSources = async () => {
      try {
        const result = await curatedRows();
        setRows(result);
      } catch {
        setRows([]);
      } finally {
        setRowsLoading(false);
      }
    };

    fetchData();
    fetchDiscovery();
    fetchContinueWatching();
    fetchSources();
  }, []);

  // On-device resume points for source titles.
  useEffect(() => {
    const sync = () => setResumes(getAllProgress().filter((p) => !p.completed).slice(0, 10));
    sync();
    return subscribeGuestStore(sync);
  }, []);

  const heroItem = useMemo(() => {
    const preferred =
      rows.find((r) => r.key === 'pd-classics') || rows.find((r) => r.items.length > 0);
    return preferred ? pickFeatured(preferred.items) : null;
  }, [rows]);

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

      {/* Billboard: a real, playable, downloadable free film when we have one */}
      {heroItem ? <SourceHero item={heroItem} eyebrow="Free · public domain" /> : <Hero movie={featured} />}

      <main className="relative z-20 -mt-24 pb-32">
        <div className="pl-5 md:pl-16 pr-4 md:pr-16">
          {/* ── Resume (on-device) ─────────────────────────────── */}
          {resumes.length > 0 && (
            <section className="mb-12 md:mb-16">
              <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold mb-4">
                Continue watching
              </h2>
              <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory">
                {resumes.map((entry) => {
                  const pct = entry.duration > 0 ? Math.min((entry.position / entry.duration) * 100, 100) : 0;
                  return (
                    <Link
                      key={`${entry.provider}:${entry.id}`}
                      href={`/player?provider=${entry.provider}&id=${encodeURIComponent(entry.id)}`}
                      className="group min-w-[260px] w-[260px] md:min-w-[320px] md:w-[320px] snap-start flex-shrink-0"
                    >
                      <div className="relative h-40 rounded-xl overflow-hidden bg-surface-container">
                        {entry.posterUrl ? (
                          <img
                            src={entry.posterUrl}
                            alt=""
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                            <Play size={20} className="text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="px-1 pt-3">
                        <h3 className="text-white font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {entry.title}
                        </h3>
                        <p className="text-on-surface-variant text-xs mt-1">
                          {formatRemaining(entry.position, entry.duration)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Free shelves from archive.org / YouTube ─────────── */}
          {rowsLoading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-64 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : (
            rows.map((row) => (
              <SourceRow
                key={row.key}
                title={row.title}
                subtitle={row.subtitle}
                items={row.items}
                href={`/browse?source=${row.key.startsWith('pd') ? 'archive' : row.key}`}
              />
            ))
          )}

          {!rowsLoading && rows.length === 0 && (
            <section className="mb-12 p-6 rounded-2xl bg-surface-container/60 border border-white/5">
              <h2 className="text-white font-bold mb-1">Free shelves could not load</h2>
              <p className="text-on-surface-variant text-sm">
                Veyra reached neither archive.org nor your API. Check the connection and reload — the
                rest of the app keeps working from cache.
              </p>
            </section>
          )}

          {/* ── Continue Watching (server-synced catalogue) ─────── */}
          {continueWatching.length > 0 && (
            <section className="mb-12 md:mb-16">
              <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold mb-5">
                Continue in your library
              </h2>
              <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory">
                {continueWatching.map((item) => {
                  const progressPct =
                    item.duration > 0 ? Math.min((item.position / item.duration) * 100, 100) : 0;
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
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                            <span className="text-white text-lg ml-0.5">▶</span>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
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

          {/* ── TMDB discovery ─────────────────────────────────── */}
          {tmdbTrending.length > 0 && (
            <DiscoveryRow title="Trending Today" items={tmdbTrending} size="md" />
          )}
          {tmdbPopularMovies.length > 0 && (
            <DiscoveryRow title="Popular Movies" items={tmdbPopularMovies} size="md" />
          )}
          {tmdbPopularTV.length > 0 && (
            <DiscoveryRow title="Popular TV Shows" items={tmdbPopularTV} size="md" />
          )}

          {/* ── Your own catalogue ─────────────────────────────── */}
          {loading ? (
            <section className="mb-12 md:mb-16">
              <div className="h-6 w-40 bg-surface-container rounded animate-pulse mb-5" />
              <SkeletonRow count={6} />
            </section>
          ) : trending.length > 0 ? (
            <MovieRow title="Trending Now" movies={trending} size="md" />
          ) : null}

          {loading ? null : recentlyAdded.length > 0 ? (
            <MovieRow title="Recently Added" movies={recentlyAdded} size="md" />
          ) : null}
        </div>
      </main>
    </div>
  );
}
