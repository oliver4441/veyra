'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard from './MovieCard';
import type { Movie } from '@/lib/api';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  size?: 'sm' | 'md' | 'lg';
}

export default function MovieRow({ title, movies, size = 'md' }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (movies.length === 0) return null;

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
        className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 snap-x"
        style={{ paddingLeft: '20px', paddingRight: '20px' }}
      >
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} size={size} />
        ))}
      </div>
    </section>
  );
}
