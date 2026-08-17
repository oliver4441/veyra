'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Info, Star, Clock, Calendar } from 'lucide-react';
import type { Movie } from '@/lib/api';

interface HeroProps {
  movie: Movie;
}

export default function Hero({ movie }: HeroProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <header className="relative w-full h-[85vh] min-h-[600px] max-h-[900px] flex items-end overflow-hidden">
      {/* Background image with subtle Ken Burns zoom */}
      <div className="absolute inset-0 z-0">
        {movie.backdropUrl ? (
          <div
            className="w-full h-full bg-cover bg-center opacity-0 transition-opacity duration-1000"
            style={{
              backgroundImage: `url('${movie.backdropUrl}')`,
              opacity: visible ? 1 : 0,
              animation: visible ? 'kenBurns 20s ease-in-out infinite alternate' : undefined,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-surface" />
        )}
      </div>

      {/* Multi-layer gradient overlay — Netflix style */}
      <div className="absolute inset-0 z-10">
        {/* Bottom-to-top dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        {/* Left-to-right fade */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />
        {/* Top navbar fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-20 px-5 md:px-16 pb-20 md:pb-24 max-w-3xl w-full">
        {/* Rating & Meta Row */}
        <div
          className={`flex items-center gap-3 mb-4 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {(movie.voteAverage || movie.imdbRating) && (
            <div className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/10">
              <Star size={14} className="text-yellow-400" fill="currentColor" />
              <span className="text-white font-bold text-sm">
                {movie.voteAverage || movie.imdbRating}
              </span>
              <span className="text-on-surface-variant text-xs">/10</span>
            </div>
          )}
          {movie.rating && (
            <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-bold rounded border border-white/20 uppercase tracking-wider">
              {movie.rating}
            </span>
          )}
          {movie.year && (
            <span className="flex items-center gap-1 text-on-surface-variant text-sm">
              <Calendar size={13} />
              {movie.year}
            </span>
          )}
          {movie.duration && (
            <span className="flex items-center gap-1 text-on-surface-variant text-sm">
              <Clock size={13} />
              {formatDuration(movie.duration)}
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          className={`font-display-xl text-5xl md:text-7xl lg:text-8xl text-white mb-4 drop-shadow-2xl transition-all duration-700 delay-100 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {movie.title}
        </h1>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div
            className={`flex flex-wrap gap-2 mb-4 transition-all duration-700 delay-200 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {movie.genres.map((g) => (
              <Link
                key={g.id}
                href={`/?genre=${g.id}`}
                className="px-3 py-1 bg-white/5 backdrop-blur-sm text-on-surface-variant text-xs font-medium rounded-full border border-white/10 hover:bg-white/10 hover:text-white transition-all"
              >
                {g.name}
              </Link>
            ))}
          </div>
        )}

        {/* Description */}
        <p
          className={`text-on-surface-variant text-base md:text-lg mb-8 max-w-xl leading-relaxed line-clamp-3 transition-all duration-700 delay-300 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {movie.shortDescription || movie.description?.slice(0, 250)}
        </p>

        {/* Action Buttons */}
        <div
          className={`flex flex-wrap gap-3 transition-all duration-700 delay-[400ms] ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Link
            href={`/watch/${movie.id}`}
            className="group flex items-center gap-2.5 bg-white text-black font-bold px-7 py-3.5 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10"
          >
            <Play size={22} fill="black" className="text-black" />
            <span>Play</span>
          </Link>
          <Link
            href={`/movie/${movie.slug}`}
            className="group flex items-center gap-2.5 bg-white/10 backdrop-blur-sm text-white font-bold px-7 py-3.5 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200"
          >
            <Info size={22} />
            <span>More Info</span>
          </Link>
        </div>
      </div>

      {/* Ken Burns animation keyframe */}
      <style jsx>{`
        @keyframes kenBurns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </header>
  );
}
