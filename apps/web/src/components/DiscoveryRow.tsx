'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { DiscoveryItem } from '@/lib/api';

interface DiscoveryRowProps {
  title: string;
  items: DiscoveryItem[];
  size?: 'sm' | 'md' | 'lg';
}

export default function DiscoveryRow({ title, items, size = 'md' }: DiscoveryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (items.length === 0) return null;

  const sizeClasses = {
    sm: 'min-w-[140px] w-[140px] md:min-w-[180px] md:w-[180px]',
    md: 'min-w-[200px] w-[200px] md:min-w-[280px] md:w-[280px]',
    lg: 'min-w-[280px] w-[280px] md:min-w-[360px] md:w-[360px]',
  };

  const heightClasses = {
    sm: 'h-20',
    md: 'h-32',
    lg: 'h-44',
  };

  return (
    <section className="mb-section-gap">
      <div className="flex items-center justify-between pr-4 md:pr-16 mb-6">
        <h2 className="font-headline-md text-headline-md text-white">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 snap-x"
        style={{ paddingLeft: '20px', paddingRight: '20px' }}
      >
        {items.map((item) => (
          <div
            key={`${item.tmdbId}-${item.mediaType}`}
            className={`card overflow-hidden flex-shrink-0 snap-start group cursor-pointer ${sizeClasses[size]}`}
          >
            {/* Poster */}
            <div className={`relative ${heightClasses[size]} bg-surface-container`}>
              {item.posterUrl || item.backdropUrl ? (
                <img
                  src={item.posterUrl || item.backdropUrl}
                  alt={item.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container flex items-center justify-center">
                  <span className="text-2xl">🎬</span>
                </div>
              )}

              {/* Type badge */}
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 bg-black/70 text-white text-[10px] rounded-full font-medium uppercase tracking-wider">
                  {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                </span>
              </div>

              {/* Rating */}
              {item.voteAverage ? (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 bg-black/70 text-yellow-400 text-[10px] rounded-full font-medium flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" />
                    {item.voteAverage.toFixed(1)}
                  </span>
                </div>
              ) : null}

              {/* Hover play overlay */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <span className="text-white text-sm">TMDB</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-white text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {item.releaseDate?.substring(0, 4) || 'N/A'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
