'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Star } from 'lucide-react';
import type { Movie } from '@/lib/api';

interface MovieCardProps {
  movie: Movie;
  size?: 'sm' | 'md' | 'lg';
}

export default function MovieCard({ movie, size = 'md' }: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'min-w-[150px] w-[150px] md:min-w-[185px] md:w-[185px]',
    md: 'min-w-[200px] w-[200px] md:min-w-[260px] md:w-[260px]',
    lg: 'min-w-[260px] w-[260px] md:min-w-[340px] md:w-[340px]',
  };

  const posterHeight = {
    sm: 'h-[225px] md:h-[278px]',   // 2:3 aspect
    md: 'h-[300px] md:h-[390px]',   // 2:3 aspect
    lg: 'h-[390px] md:h-[510px]',   // 2:3 aspect
  };

  const rating = movie.voteAverage || movie.imdbRating;

  return (
    <Link href={`/movie/${movie.slug}`} className="block group">
      <div
        className={`relative flex-shrink-0 snap-start transition-all duration-300 ${sizeClasses[size]}`}
      >
        {/* Poster */}
        <div
          className={`relative ${posterHeight[size]} rounded-xl overflow-hidden bg-surface-container`}
        >
          {/* Skeleton loader */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-surface-container animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            </div>
          )}

          {/* Image */}
          {(movie.posterUrl || movie.backdropUrl) && !imageError ? (
            <img
              src={movie.posterUrl || movie.backdropUrl}
              alt={movie.title}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container flex items-center justify-center">
              <span className="text-4xl">🎬</span>
            </div>
          )}

          {/* Hover overlay with play button */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-2xl">
              <Play size={26} className="text-white ml-1" fill="white" />
            </div>
          </div>

          {/* Top-left: Type badge */}
          <div className="absolute top-3 left-3 z-10">
            <span className="px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] rounded-md font-bold uppercase tracking-wider">
              {movie.type === 'series' ? 'Series' : 'Movie'}
            </span>
          </div>

          {/* Top-right: Rating badge */}
          {rating && (
            <div className="absolute top-3 right-3 z-10">
              <span className="px-2 py-1 bg-black/70 backdrop-blur-sm text-yellow-400 text-[11px] rounded-md font-bold flex items-center gap-1">
                <Star size={10} fill="currentColor" />
                {rating.toFixed(1)}
              </span>
            </div>
          )}

          {/* Bottom gradient for title overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Bottom: Title on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <h3 className="text-white font-bold text-sm leading-tight drop-shadow-lg">
              {movie.title}
            </h3>
            {movie.genres && movie.genres.length > 0 && (
              <p className="text-on-surface-variant text-xs mt-1 line-clamp-1">
                {movie.genres.slice(0, 2).map((g) => g.name).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Info below poster */}
        <div className="px-1 pt-3 pb-1">
          <h3 className="text-white font-semibold text-sm truncate group-hover:text-primary transition-colors duration-200">
            {movie.title}
          </h3>
          <div className="flex items-center gap-2 text-on-surface-variant text-xs mt-1">
            {movie.year && <span>{movie.year}</span>}
            {movie.year && movie.duration && <span className="text-white/20">·</span>}
            {movie.duration && (
              <span>
                {Math.floor(movie.duration / 3600)}h{' '}
                {Math.floor((movie.duration % 3600) / 60)}m
              </span>
            )}
          </div>
        </div>

        {/* Hover glow effect */}
        <div className="absolute -inset-1 rounded-xl bg-primary/0 group-hover:bg-primary/5 transition-all duration-300 -z-10" />
      </div>
    </Link>
  );
}
