'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SourceHero — the billboard, pointed at something you can actually watch
// ─────────────────────────────────────────────────────────────────────────────
// Same cinematic treatment as Hero, but for a title that comes from a free
// source (normally a public-domain film on the Internet Archive). The Play
// button starts real playback and Download queues a real file — no placeholder
// artwork and no dead links.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Download, Play, ShieldCheck } from 'lucide-react';
import type { SourceItem } from '@/lib/sources/types';
import { ProviderBadge, formatRuntime } from './SourceCard';
import { getSource } from '@/lib/sources/registry';

interface SourceHeroProps {
  item: SourceItem;
  /** Shown above the title, e.g. "Free tonight". */
  eyebrow?: string;
}

export default function SourceHero({ item, eyebrow }: SourceHeroProps) {
  const [visible, setVisible] = useState(false);
  const [imageOk, setImageOk] = useState(true);
  const source = getSource(item.provider);
  const downloadable = source?.capabilities.download === 'allowed';
  const runtime = formatRuntime(item.durationSec);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, [item.id]);

  const detailHref = `/source?provider=${item.provider}&id=${encodeURIComponent(item.id)}`;
  const playHref = `/player?provider=${item.provider}&id=${encodeURIComponent(item.id)}`;

  return (
    <header className="relative w-full h-[85vh] min-h-[560px] max-h-[900px] flex items-end overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 z-0">
        {item.backdropUrl && imageOk ? (
          <div
            className="w-full h-full bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url('${item.backdropUrl}')`,
              opacity: visible ? 1 : 0,
              animation: visible ? 'kenBurns 22s ease-in-out infinite alternate' : undefined,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/25 via-surface to-background" />
        )}
        <img
          src={item.backdropUrl}
          alt=""
          className="hidden"
          onError={() => setImageOk(false)}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/35 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-20 px-5 md:px-16 pb-20 md:pb-24 max-w-3xl w-full">
        <div
          className={`flex items-center gap-2.5 mb-4 flex-wrap transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <ProviderBadge provider={item.provider} className="bg-black/60" />
          {eyebrow && (
            <span className="px-2.5 py-1 bg-primary/15 backdrop-blur-sm text-primary text-[11px] font-bold rounded border border-primary/25 uppercase tracking-wider">
              {eyebrow}
            </span>
          )}
          {item.year && (
            <span className="flex items-center gap-1 text-on-surface-variant text-sm">
              <Calendar size={13} /> {item.year}
            </span>
          )}
          {runtime && (
            <span className="flex items-center gap-1 text-on-surface-variant text-sm">
              <Clock size={13} /> {runtime}
            </span>
          )}
          {item.license && (
            <span className="flex items-center gap-1 text-emerald-300/90 text-xs">
              <ShieldCheck size={13} /> {item.license}
            </span>
          )}
        </div>

        <h1
          className={`font-display-xl text-4xl md:text-6xl lg:text-7xl text-white mb-4 drop-shadow-2xl transition-all duration-700 delay-100 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {item.title}
        </h1>

        {item.description && (
          <p
            className={`text-on-surface-variant text-base md:text-lg mb-8 max-w-xl leading-relaxed line-clamp-3 transition-all duration-700 delay-200 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {item.description}
          </p>
        )}

        <div
          className={`flex flex-wrap gap-3 transition-all duration-700 delay-300 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Link
            href={playHref}
            className="group flex items-center gap-2.5 bg-white text-black font-bold px-7 py-3.5 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10"
          >
            <Play size={22} fill="black" className="text-black" />
            <span>Play free</span>
          </Link>
          <Link
            href={detailHref}
            className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm text-white font-bold px-7 py-3.5 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200"
          >
            {downloadable ? <Download size={20} /> : null}
            <span>{downloadable ? 'Details & download' : 'More info'}</span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes kenBurns {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.08);
          }
        }
      `}</style>
    </header>
  );
}
