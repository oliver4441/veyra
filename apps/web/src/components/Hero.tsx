'use client';

import Link from 'next/link';
import { Play, Info } from 'lucide-react';
import type { Movie } from '@/lib/api';

interface HeroProps {
  movie: Movie;
}

export default function Hero({ movie }: HeroProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <header className="relative w-full h-[819px] min-h-[600px] flex items-center justify-start overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {movie.backdropUrl ? (
          <div
            className="bg-cover bg-center w-full h-full opacity-60"
            style={{ backgroundImage: `url('${movie.backdropUrl}')` }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-surface" />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 hero-gradient z-10" />

      {/* Content */}
      <div className="relative z-20 px-5 md:px-16 max-w-3xl pt-20">
        {/* Meta info */}
        <div className="flex items-center gap-3 mb-4">
          {movie.rating && (
            <span className="chip">{movie.rating}</span>
          )}
          {movie.year && (
            <span className="font-label-caps text-xs text-on-surface-variant">
              {movie.year}
            </span>
          )}
          {movie.duration && (
            <span className="font-label-caps text-xs text-on-surface-variant flex items-center">
              <span className="material-symbols-outlined text-sm mr-1">schedule</span>
              {formatDuration(movie.duration)}
            </span>
          )}
          {movie.genres && movie.genres.length > 0 && (
            <span className="font-label-caps text-xs text-primary">
              {movie.genres.map((g) => g.name).join(' / ')}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-display-xl text-4xl md:text-7xl text-white mb-4 drop-shadow-lg">
          {movie.title}
        </h1>

        {/* Description */}
        <p className="font-body-lg text-lg text-on-surface-variant mb-8 max-w-xl">
          {movie.shortDescription || movie.description?.slice(0, 200)}
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
          <Link
            href={`/movie/${movie.slug}`}
            className="btn-glass flex items-center gap-2"
          >
            <Info size={24} />
            More Info
          </Link>
        </div>
      </div>
    </header>
  );
}
