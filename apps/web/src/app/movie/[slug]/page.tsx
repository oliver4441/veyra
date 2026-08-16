'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Play, Bookmark, Share2, Clock, Calendar, Star } from 'lucide-react';
import { api, type Movie } from '@/lib/api';

export default function MovieDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const { movie: data } = await api.getMovie(slug);
        setMovie(data);
      } catch (err) {
        setError('Movie not found');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchMovie();
    }
  }, [slug]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-2xl font-bold text-white mb-4">Movie Not Found</h1>
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero/Backdrop */}
      <div className="relative w-full h-[70vh] min-h-[500px]">
        {movie.backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${movie.backdropUrl}')` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-surface" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 hero-gradient z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 md:px-16 pb-12">
          <div className="max-w-4xl">
            {/* Title */}
            <h1 className="font-display-xl text-5xl md:text-7xl text-white mb-4 drop-shadow-lg">
              {movie.title}
            </h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {(movie.voteAverage || movie.imdbRating) && (
                <div className="flex items-center gap-1 text-primary">
                  <Star size={18} fill="currentColor" />
                  <span className="font-bold">{movie.voteAverage || movie.imdbRating}</span>
                  <span className="text-on-surface-variant text-sm">/10</span>
                  {movie.voteCount ? (
                    <span className="text-on-surface-variant text-xs">({movie.voteCount.toLocaleString()} votes)</span>
                  ) : null}
                </div>
              )}
              {movie.year && (
                <div className="flex items-center gap-1 text-on-surface-variant">
                  <Calendar size={16} />
                  <span>{movie.year}</span>
                </div>
              )}
              {movie.duration && (
                <div className="flex items-center gap-1 text-on-surface-variant">
                  <Clock size={16} />
                  <span>{formatDuration(movie.duration)}</span>
                </div>
              )}
              {movie.rating && (
                <span className="chip">{movie.rating}</span>
              )}
              {movie.type === 'series' && (
                <span className="chip">Series</span>
              )}
              {movie.originalLanguage && (
                <span className="text-on-surface-variant text-sm">
                  {movie.originalLanguage.toUpperCase()}
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/?genre=${genre.id}`}
                    className="chip hover:bg-white/20 transition-colors"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-on-surface-variant text-lg mb-8 max-w-2xl leading-relaxed">
              {movie.description || movie.shortDescription}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-4">
              <Link
                href={`/watch/${movie.id}`}
                className="btn-primary flex items-center gap-2"
              >
                <Play size={24} fill="white" />
                Play Now
              </Link>
              <button className="btn-glass flex items-center gap-2">
                <Bookmark size={20} />
                Watchlist
              </button>
              <button className="btn-glass flex items-center gap-2">
                <Share2 size={20} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <main className="relative z-20 px-5 md:px-16 py-12">
        <div className="max-w-4xl">
          {/* Director & Cast */}
          {(movie.director || movie.cast) && (
            <div className="mb-8">
              <h2 className="font-headline-md text-xl text-white mb-4">Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movie.director && (
                  <div>
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Director
                    </span>
                    <span className="text-white">{movie.director}</span>
                  </div>
                )}
                {movie.cast && movie.cast.length > 0 && (
                  <div>
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Cast
                    </span>
                    <span className="text-white">{movie.cast.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {movie.tags && movie.tags.length > 0 && (
            <div className="mb-8">
              <h2 className="font-headline-md text-xl text-white mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {movie.tags.map((tag, i) => (
                  <span key={i} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* TMDB Metadata */}
          {(movie.productionCountries && movie.productionCountries.length > 0) ||
           (movie.spokenLanguages && movie.spokenLanguages.length > 0) ? (
            <div className="mb-8">
              <h2 className="font-headline-md text-xl text-white mb-4">Production</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movie.productionCountries && movie.productionCountries.length > 0 && (
                  <div>
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Countries
                    </span>
                    <span className="text-white">{movie.productionCountries.join(', ')}</span>
                  </div>
                )}
                {movie.spokenLanguages && movie.spokenLanguages.length > 0 && (
                  <div>
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Languages
                    </span>
                    <span className="text-white">{movie.spokenLanguages.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Trailer */}
          {movie.trailerUrl && (
            <div className="mb-8">
              <h2 className="font-headline-md text-xl text-white mb-4">Trailer</h2>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${movie.trailerUrl.includes('v=') ? movie.trailerUrl.split('v=')[1]?.split('&')[0] : movie.trailerUrl}`}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* TMDB Metadata Badge */}
          {movie.tmdbId && (
            <div className="mb-8 p-4 bg-surface-container rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-on-surface-variant text-xs mb-1">TMDB Metadata</p>
                  <p className="text-white text-sm">
                    ID: {movie.tmdbId} · {movie.tmdbMediaType === 'tv' ? 'TV Show' : 'Movie'}
                    {movie.releaseDate ? ` · Released ${movie.releaseDate}` : ''}
                  </p>
                </div>
                <a
                  href={`https://www.themoviedb.org/${movie.tmdbMediaType || 'movie'}/${movie.tmdbId}`}
                  target=""
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline"
                >
                  View on TMDB →
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
