'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Bookmark, Trash2, Loader2, Film, Plus } from 'lucide-react';
import { api, type Movie } from '@/lib/api';
import { SkeletonGrid } from '@/components/SkeletonCard';

interface WatchlistItem {
  id: number;
  addedAt: string;
  movie: Movie;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await api.getWatchlist();
      setItems(res.watchlist.filter((w) => w.movie));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleRemove = async (movieId: number) => {
    setRemovingId(movieId);
    try {
      await api.removeFromWatchlist(movieId);
      setItems((prev) => prev.filter((i) => i.movie.id !== movieId));
    } finally {
      setRemovingId(null);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Bookmark className="w-6 h-6 text-primary" />
              <h1 className="font-headline-md text-3xl md:text-4xl text-white">My Watchlist</h1>
            </div>
            <p className="text-on-surface-variant text-sm">
              {loading ? (
                <span className="inline-block w-28 h-4 bg-surface-container rounded animate-pulse" />
              ) : (
                `${items.length} saved title${items.length === 1 ? '' : 's'}`
              )}
            </p>
          </div>
          {!loading && items.length > 0 && (
            <Link
              href="/browse"
              className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              Add More
            </Link>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonGrid count={10} size="sm" />
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative flex gap-4 p-4 bg-surface-container rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200"
              >
                {/* Poster */}
                <Link
                  href={`/movie/${item.movie.slug}`}
                  className="flex-shrink-0"
                >
                  {item.movie.posterUrl ? (
                    <img
                      src={item.movie.posterUrl}
                      alt={item.movie.title}
                      className="w-20 h-28 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-surface-variant rounded-lg flex items-center justify-center">
                      <Film size={24} className="text-on-surface-variant" />
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0 py-1">
                  <Link href={`/movie/${item.movie.slug}`}>
                    <h3 className="text-white font-semibold truncate group-hover:text-primary transition-colors">
                      {item.movie.title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-2 mt-1 text-on-surface-variant text-xs">
                    {item.movie.year && <span>{item.movie.year}</span>}
                    {item.movie.duration && (
                      <>
                        <span className="text-white/20">·</span>
                        <span>{formatDuration(item.movie.duration)}</span>
                      </>
                    )}
                    {item.movie.type === 'series' && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="text-primary">Series</span>
                      </>
                    )}
                  </div>

                  {item.movie.genres && item.movie.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.movie.genres.slice(0, 3).map((g) => (
                        <span
                          key={g.id}
                          className="px-2 py-0.5 bg-white/5 text-on-surface-variant text-[10px] rounded"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-on-surface-variant/60 text-xs mt-2">
                    Added {new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(item.movie.id)}
                  disabled={removingId === item.movie.id}
                  aria-label={`Remove ${item.movie.title} from watchlist`}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-high/50 flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  {removingId === item.movie.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
              <Bookmark size={32} className="text-on-surface-variant opacity-50" />
            </div>
            <h2 className="font-headline-md text-xl text-white mb-2">Your watchlist is empty</h2>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-8">
              Save movies and series you want to watch later. They&apos;ll show up here, ready when you are.
            </p>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
            >
              Browse Titles
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
