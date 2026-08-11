'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import MovieRow from '@/components/MovieRow';
import { api, type Movie } from '@/lib/api';

// Mock data for demo (will be replaced with API calls)
const mockFeatured: Movie = {
  id: 1,
  title: 'The Midnight Echo',
  slug: 'the-midnight-echo',
  description: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  shortDescription: 'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
  type: 'movie',
  year: 2024,
  duration: 8100, // 2h 15m
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

const mockMovies: Movie[] = [
  {
    id: 2,
    title: 'Shadow Protocol',
    slug: 'shadow-protocol',
    type: 'movie',
    year: 2024,
    duration: 7200,
    rating: 'R',
    posterUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-t2h6GTspWwWui1hdiqysrFUt3nKQjRQ9W8mRyxQh_AU50S9lxnHwqpN9mPCu-KdxQCyknGH2b8vIhhzF_dx-L267oKL_txzIzfoCtkduuBgl-vNiaI5RTl75rau_IdQkc4a8_E_-PIHFmSC2JRRTduq7ViFIkzVp-lvnmO0DyYKDLr9xk1oTHSUk5nf4cy_OsuHaDdSztoxahrfW14Q4m-uHJCsbUHl6fMtIpitgVC3r4S_l1Jq1Ig',
    backdropUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-t2h6GTspWwWui1hdiqysrFUt3nKQjRQ9W8mRyxQh_AU50S9lxnHwqpN9mPCu-KdxQCyknGH2b8vIhhzF_dx-L267oKL_txzIzfoCtkduuBgl-vNiaI5RTl75rau_IdQkc4a8_E_-PIHFmSC2JRRTduq7ViFIkzVp-lvnmO0DyYKDLr9xk1oTHSUk5nf4cy_OsuHaDdSztoxahrfW14Q4m-uHJCsbUHl6fMtIpitgVC3r4S_l1Jq1Ig',
    genres: [{ id: 3, name: 'Action', slug: 'action' }],
    status: 'published',
    trending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: 'Neon Nights',
    slug: 'neon-nights',
    type: 'movie',
    year: 2024,
    duration: 5400,
    posterUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpCUordSgIkXcMqxc228JR6WE6HhdXiN-pjiCjwfr8Z504MsGD3YzpTuVGVgI4txsU0TW7BtwDNInNe1d88MUJqOH5csyfmCNJGTn5BjtPBVR5d2Kfb82L48iiwre5SmdEj8LM9rH8EO6llvrPI1i4JhdPvG0J6Si2LsE7UgQF4ew88Yyx6ahUO6v3Afu_26qx7PI3Npnh5jUmrvUrfYJqHOYjZ6CORikTzDeyXiGSSGD97NPSYMVKNg',
    backdropUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpCUordSgIkXcMqxc228JR6WE6HhdXiN-pjiCjwfr8Z504MsGD3YzpTuVGVgI4txsU0TW7BtwDNInNe1d88MUJqOH5csyfmCNJGTn5BjtPBVR5d2Kfb82L48iiwre5SmdEj8LM9rH8EO6llvrPI1i4JhdPvG0J6Si2LsE7UgQF4ew88Yyx6ahUO6v3Afu_26qx7PI3Npnh5jUmrvUrfYJqHOYjZ6CORikTzDeyXiGSSGD97NPSYMVKNg',
    genres: [{ id: 4, name: 'Cyberpunk', slug: 'cyberpunk' }],
    status: 'published',
    trending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    title: 'Crimson Horizon',
    slug: 'crimson-horizon',
    type: 'movie',
    year: 2023,
    duration: 6300,
    rating: 'PG-13',
    posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
    backdropUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800',
    genres: [{ id: 5, name: 'Drama', slug: 'drama' }],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    title: 'Quantum Drift',
    slug: 'quantum-drift',
    type: 'series',
    year: 2024,
    duration: 3600,
    posterUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400',
    backdropUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800',
    genres: [{ id: 1, name: 'Sci-Fi', slug: 'sci-fi' }],
    status: 'published',
    trending: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 6,
    title: 'The Last Signal',
    slug: 'the-last-signal',
    type: 'movie',
    year: 2024,
    duration: 7800,
    posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400',
    backdropUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    genres: [{ id: 2, name: 'Thriller', slug: 'thriller' }],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [featured, setFeatured] = useState<Movie>(mockFeatured);
  const [trending, setTrending] = useState<Movie[]>(mockMovies);
  const [recentlyAdded, setRecentlyAdded] = useState<Movie[]>(mockMovies);
  const [actionMovies, setActionMovies] = useState<Movie[]>(mockMovies);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to fetch from API, fall back to mock data
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
        if (trendingRes.status === 'fulfilled') {
          setTrending(trendingRes.value.movies);
        }
        if (moviesRes.status === 'fulfilled') {
          setRecentlyAdded(moviesRes.value.movies);
        }
      } catch {
        // Use mock data
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <Hero movie={featured} />

      {/* Content Rows */}
      <main className="relative z-20 -mt-20 pb-32">
        {/* Continue Watching */}
        <section className="pl-5 md:pl-16 mb-section-gap">
          <h2 className="font-headline-md text-headline-md text-white mb-6 pr-4 md:pr-16">
            Continue Watching
          </h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 snap-x">
            {mockMovies.slice(0, 2).map((movie) => (
              <div
                key={movie.id}
                className="card min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] snap-start"
              >
                <div className="relative h-40 bg-surface-container">
                  {movie.backdropUrl ? (
                    <img
                      src={movie.backdropUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-body-lg text-body-lg text-white font-semibold mb-2">
                    {movie.title}
                  </h3>
                  <div className="w-full bg-surface-variant rounded-full h-1.5 mb-2 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${Math.random() * 80 + 20}%` }}
                    />
                  </div>
                  <span className="text-on-surface-variant font-label-caps text-xs">
                    {Math.floor(Math.random() * 60 + 10)}m remaining
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trending Now */}
        <div className="pl-5 md:pl-16">
          <MovieRow title="Trending Now" movies={trending} size="md" />
        </div>

        {/* Recently Added */}
        <div className="pl-5 md:pl-16">
          <MovieRow title="Recently Added" movies={recentlyAdded} size="md" />
        </div>

        {/* Action */}
        <div className="pl-5 md:pl-16">
          <MovieRow title="Action & Adventure" movies={actionMovies} size="md" />
        </div>
      </main>
    </div>
  );
}
