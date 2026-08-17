'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { DiscoveryItem } from '@/lib/api';

interface DiscoveryRowProps {
  title: string;
  items: DiscoveryItem[];
  size?: 'sm' | 'md' | 'lg';
}

export default function DiscoveryRow({ title, items, size = 'md' }: DiscoveryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = size === 'sm' ? 180 : size === 'md' ? 280 : 360;
    el.scrollBy({ left: direction === 'left' ? -cardWidth * 2 : cardWidth * 2, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  const sizeClasses = {
    sm: 'min-w-[130px] w-[130px] md:min-w-[165px] md:w-[165px]',
    md: 'min-w-[185px] w-[185px] md:min-w-[260px] md:w-[260px]',
    lg: 'min-w-[260px] w-[260px] md:min-w-[340px] md:w-[340px]',
  };

  const posterHeight = {
    sm: 'h-[195px] md:h-[248px]',
    md: 'h-[278px] md:h-[390px]',
    lg: 'h-[390px] md:h-[510px]',
  };

  return (
    <section
      className="mb-12 md:mb-16"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 md:mb-5">
        <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold">
          {title}
        </h2>
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-0 bottom-0 w-12 z-10 flex items-center justify-start pl-1 bg-gradient-to-r from-background/90 to-transparent transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Scroll left"
          >
            <div className="w-9 h-9 rounded-full bg-surface-container/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-all border border-white/5">
              <ChevronLeft size={18} />
            </div>
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-0 bottom-0 w-12 z-10 flex items-center justify-end pr-1 bg-gradient-to-l from-background/90 to-transparent transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Scroll right"
          >
            <div className="w-9 h-9 rounded-full bg-surface-container/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-all border border-white/5">
              <ChevronRight size={18} />
            </div>
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div
              key={`${item.tmdbId}-${item.mediaType}`}
              className={`relative flex-shrink-0 snap-start group cursor-pointer ${sizeClasses[size]}`}
            >
              {/* Poster */}
              <div className={`relative ${posterHeight[size]} rounded-xl overflow-hidden bg-surface-container`}>
                {item.posterUrl || item.backdropUrl ? (
                  <img
                    src={item.posterUrl || item.backdropUrl}
                    alt={item.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container flex items-center justify-center">
                    <span className="text-2xl">🎬</span>
                  </div>
                )}

                {/* Type badge */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-[10px] rounded-md font-bold uppercase tracking-wider">
                    {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                  </span>
                </div>

                {/* Rating badge */}
                {item.voteAverage ? (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="px-2 py-1 bg-black/70 backdrop-blur-sm text-yellow-400 text-[11px] rounded-md font-bold flex items-center gap-1">
                      <Star size={10} fill="currentColor" />
                      {item.voteAverage.toFixed(1)}
                    </span>
                  </div>
                ) : null}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300" />
              </div>

              {/* Info */}
              <div className="px-1 pt-3 pb-1">
                <h3 className="text-white font-semibold text-sm truncate group-hover:text-primary transition-colors duration-200">
                  {item.title}
                </h3>
                <p className="text-on-surface-variant text-xs mt-0.5">
                  {item.releaseDate?.substring(0, 4) || 'N/A'}
                </p>
              </div>
            </div>
          ))}
          {/* Right padding */}
          <div className="flex-shrink-0 w-4 md:w-16" />
        </div>
      </div>
    </section>
  );
}
