'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SourceCard from './SourceCard';
import type { SourceItem } from '@/lib/sources/types';

interface SourceRowProps {
  title: string;
  subtitle?: string;
  items: SourceItem[];
  size?: 'sm' | 'md';
  /** Optional "See all" destination. */
  href?: string;
  hrefLabel?: string;
}

/**
 * Horizontal shelf of provider results. Mirrors DiscoveryRow's feel so
 * Archive.org/YouTube shelves sit naturally next to the TMDB ones.
 */
export default function SourceRow({
  title,
  subtitle,
  items,
  size = 'md',
  href,
  hrefLabel = 'See all',
}: SourceRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [hovered, setHovered] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section
      className="mb-10 md:mb-14"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-end justify-between mb-4 gap-4">
        <div className="min-w-0">
          <h2 className="font-headline-md text-lg md:text-xl text-white font-semibold truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-on-surface-variant text-xs md:text-sm mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {href && (
            <a
              href={href}
              className="text-primary text-xs md:text-sm font-medium hover:underline"
            >
              {hrefLabel}
            </a>
          )}
        </div>
      </div>

      <div className="relative">
        {canLeft && (
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className={`absolute left-0 top-0 bottom-6 w-12 z-10 flex items-center justify-start pl-1 bg-gradient-to-r from-background/90 to-transparent transition-opacity duration-200 ${
              hovered ? 'opacity-100' : 'opacity-0 md:opacity-0'
            }`}
          >
            <span className="w-9 h-9 rounded-full bg-surface-container/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-white border border-white/5">
              <ChevronLeft size={18} />
            </span>
          </button>
        )}

        {canRight && (
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className={`absolute right-0 top-0 bottom-6 w-12 z-10 flex items-center justify-end pr-1 bg-gradient-to-l from-background/90 to-transparent transition-opacity duration-200 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="w-9 h-9 rounded-full bg-surface-container/80 backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-white border border-white/5">
              <ChevronRight size={18} />
            </span>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar pb-2 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item) => (
            <SourceCard key={`${item.provider}:${item.id}`} item={item} size={size} />
          ))}
          <div className="flex-shrink-0 w-4 md:w-16" />
        </div>
      </div>
    </section>
  );
}
