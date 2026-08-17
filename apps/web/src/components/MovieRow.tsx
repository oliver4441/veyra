'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard from './MovieCard';
import type { Movie } from '@/lib/api';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  size?: 'sm' | 'md' | 'lg';
  seeAllHref?: string;
}

export default function MovieRow({ title, movies, size = 'md', seeAllHref }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  }, [movies]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = size === 'sm' ? 200 : size === 'md' ? 280 : 360;
    el.scrollBy({ left: direction === 'left' ? -cardWidth * 2 : cardWidth * 2, behavior: 'smooth' });
  };

  if (movies.length === 0) return null;

  return (
    <section
      className="mb-12 md:mb-16"
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 md:mb-5">
        <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold">
          {title}
        </h2>
        {seeAllHref && (
          <a
            href={seeAllHref}
            className="text-on-surface-variant text-xs font-medium hover:text-white transition-colors"
          >
            See All →
          </a>
        )}
      </div>

      {/* Scroll Container */}
      <div className="relative group/row">
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
          {/* Left padding */}
          <div className="flex-shrink-0 w-0 md:w-0" />
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} size={size} />
          ))}
          {/* Right padding */}
          <div className="flex-shrink-0 w-4 md:w-16" />
        </div>
      </div>
    </section>
  );
}
