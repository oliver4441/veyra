'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import type { Movie } from '@/lib/api';

interface MovieCardProps {
  movie: Movie;
  size?: 'sm' | 'md' | 'lg';
}

export default function MovieCard({ movie, size = 'md' }: MovieCardProps) {
  const sizeClasses = {
    sm: 'min-w-[160px] w-[160px] md:min-w-[200px] md:w-[200px]',
    md: 'min-w-[240px] w-[240px] md:min-w-[320px] md:w-[320px]',
    lg: 'min-w-[300px] w-[300px] md:min-w-[400px] md:w-[400px]',
  };

  const heightClasses = {
    sm: 'h-24',
    md: 'h-40',
    lg: 'h-52',
  };

  return (
    <Link href={`/movie/${movie.slug}`} className="block group">
      <div
        className={`card overflow-hidden flex-shrink-0 snap-start ${sizeClasses[size]}`}
      >
        {/* Poster/Thumbnail */}
        <div className={`relative ${heightClasses[size]} bg-surface-container`}>
          {movie.posterUrl || movie.backdropUrl ? (
            <img
              src={movie.backdropUrl || movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container flex items-center justify-center">
              <span className="text-4xl">🎬</span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Play size={24} className="text-white ml-1" fill="white" />
            </div>
          </div>

          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span className="chip">{movie.type === 'series' ? 'Series' : 'Movie'}</span>
          </div>

          {/* Rating badge */}
          {movie.rating && (
            <div className="absolute top-3 right-3">
              <span className="chip">{movie.rating}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-body-lg text-body-lg text-white font-semibold mb-1 truncate group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            {movie.year && <span>{movie.year}</span>}
            {movie.duration && (
              <span className="flex items-center gap-1">
                {Math.floor(movie.duration / 3600)}h{' '}
                {Math.floor((movie.duration % 3600) / 60)}m
              </span>
            )}
            {movie.imdbRating && (
              <span className="flex items-center gap-1 text-primary">
                ⭐ {movie.imdbRating}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
