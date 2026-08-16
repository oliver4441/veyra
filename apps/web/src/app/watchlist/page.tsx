'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { Bookmark, Trash2, Loader2 } from 'lucide-react';
import { api, type Movie } from '@/lib/api';

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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Bookmark className="w-6 h-6 text-primary" />
          <h1 className="font-headline-md text-3xl md:text-4xl text-white">My Watchlist</h1>
        </div>
        <p className="text-on-surface-variant mb-10">
          {loading ? 'Loading...' : `${items.length} saved title${items.length === 1 ? '' : 's'}`}
        </p>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                <MovieCard movie={item.movie} size="sm" />
                <button
                  onClick={() => handleRemove(item.movie.id)}
                  disabled={removingId === item.movie.id}
                  aria-label={`Remove ${item.movie.title} from watchlist`}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full glass-panel flex items-center justify-center text-on-surface-variant hover:text-error hover:border-error/50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 z-10"
                >
                  {removingId === item.movie.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <Bookmark className="w-16 h-16 mx-auto mb-6 text-surface-variant" />
            <h2 className="font-headline-md text-xl text-white mb-2">Your watchlist is empty</h2>
            <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
              Save movies and series you want to watch later. They&apos;ll show up here.
            </p>
            <Link href="/browse" className="btn-primary">
              Browse Titles
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
