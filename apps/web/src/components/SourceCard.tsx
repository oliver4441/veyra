'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Provider badge + source card + source shelf
// ─────────────────────────────────────────────────────────────────────────────
// Small presentational pieces shared by the homepage shelves, search results
// and the title detail page.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { useState } from 'react';
import { Download, ExternalLink, Play, Film, Tv } from 'lucide-react';
import { providerBadgeClass, providerLabel, getSource } from '@/lib/sources/registry';
import type { SourceItem, SourceProviderId } from '@/lib/sources/types';

export function ProviderBadge({
  provider,
  className = '',
}: {
  provider: SourceProviderId;
  className?: string;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${providerBadgeClass(
        provider
      )} ${className}`}
    >
      {providerLabel(provider)}
    </span>
  );
}

export function formatRuntime(seconds?: number): string | null {
  if (!seconds || seconds < 30) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Canonical in-app link for any source item. */
export function sourceHref(item: Pick<SourceItem, 'provider' | 'id'>): string {
  return `/source?provider=${item.provider}&id=${encodeURIComponent(item.id)}`;
}

interface SourceCardProps {
  item: SourceItem;
  size?: 'sm' | 'md';
  /** Show a download affordance when the provider allows saving. */
  showDownload?: boolean;
}

export default function SourceCard({ item, size = 'md', showDownload = true }: SourceCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = getSource(item.provider);
  const downloadable = showDownload && source?.capabilities.download === 'allowed';
  const runtime = formatRuntime(item.durationSec);
  const external = item.provider === 'external';

  return (
    <Link href={sourceHref(item)} className="block group">
      <div
        className={`relative flex-shrink-0 snap-start transition-all duration-300 ${
          size === 'sm'
            ? 'min-w-[140px] w-[140px] md:min-w-[170px] md:w-[170px]'
            : 'min-w-[170px] w-[170px] md:min-w-[210px] md:w-[210px]'
        }`}
      >
        <div
          className={`relative rounded-xl overflow-hidden bg-surface-container ${
            size === 'sm' ? 'h-[210px] md:h-[255px]' : 'h-[255px] md:h-[315px]'
          }`}
        >
          {!loaded && !failed && (
            <div className="absolute inset-0 bg-surface-container animate-pulse" />
          )}

          {item.posterUrl && !failed ? (
            <img
              src={item.posterUrl}
              alt={item.title}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-surface-container flex items-center justify-center">
              {item.kind === 'series' ? (
                <Tv size={30} className="text-on-surface-variant" />
              ) : (
                <Film size={30} className="text-on-surface-variant" />
              )}
            </div>
          )}

          {/* Provider badge */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <ProviderBadge provider={item.provider} className="bg-black/70" />
          </div>

          {/* Downloadable marker */}
          {downloadable && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <span className="p-1.5 rounded-md bg-black/70 backdrop-blur-sm text-emerald-300 border border-emerald-400/20">
                <Download size={12} />
              </span>
            </div>
          )}

          {/* Hover play */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
              {external ? (
                <ExternalLink size={20} className="text-white" />
              ) : (
                <Play size={22} className="text-white ml-0.5" fill="white" />
              )}
            </div>
          </div>
        </div>

        <div className="px-1 pt-2.5 pb-1">
          <h3 className="text-white font-semibold text-sm truncate group-hover:text-primary transition-colors duration-200">
            {item.title}
          </h3>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mt-0.5">
            {item.year && <span>{item.year}</span>}
            {item.year && runtime && <span className="text-white/20">·</span>}
            {runtime && <span>{runtime}</span>}
            {!item.year && !runtime && item.license && <span className="truncate">{item.license}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
