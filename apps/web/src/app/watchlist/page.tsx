'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /watchlist — My List
// ─────────────────────────────────────────────────────────────────────────────
// Two shelves, because there are two kinds of thing you can save:
//   • titles from free sources (archive.org, YouTube) → kept on this device
//   • titles from your own catalogue → kept by the API, keyed to the device id
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Clock, Download, Film, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SourceCard, { ProviderBadge, formatRuntime } from '@/components/SourceCard';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { api, type Movie } from '@/lib/api';
import { getMyList, removeFromMyList, subscribeGuestStore, type SavedItem } from '@/lib/mylist';

interface WatchlistItem {
  id: number;
  addedAt: string;
  movie: Movie;
}

export default function WatchlistPage() {
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setSaved(getMyList());
    sync();
    return subscribeGuestStore(sync);
  }, []);

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

  const handleRemoveCatalog = async (movieId: number) => {
    try {
      await api.removeFromWatchlist(movieId);
      setItems((prev) => prev.filter((i) => i.movie.id !== movieId));
    } catch {
      // ignore
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const empty = saved.length === 0 && items.length === 0 && !loading;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-headline-lg text-2xl md:text-4xl text-white font-bold mb-1">
              My List
            </h1>
            <p className="text-on-surface-variant text-sm">
              Saved on this device — no account, no sync, nothing leaves your phone.
            </p>
          </div>
          <span className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant text-xs">
            <Bookmark size={13} /> {saved.length + items.length} saved
          </span>
        </div>

        {/* Free sources */}
        {saved.length > 0 && (
          <section className="mb-12">
            <h2 className="font-headline-md text-base md:text-lg text-white font-semibold mb-4">
              From free sources
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {saved.map((item) => (
                <div key={`${item.provider}:${item.id}`} className="relative group">
                  <SourceCard
                    item={{
                      provider: item.provider,
                      id: item.id,
                      title: item.title,
                      year: item.year,
                      posterUrl: item.posterUrl,
                      kind: item.kind,
                      license: item.license,
                    }}
                    size="sm"
                  />
                  <button
                    onClick={() => removeFromMyList(item.provider, item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Catalogue */}
        {loading ? (
          <SkeletonGrid count={5} size="sm" />
        ) : items.length > 0 ? (
          <section className="mb-12">
            <h2 className="font-headline-md text-base md:text-lg text-white font-semibold mb-4">
              From your library
            </h2>
            <div className="space-y-3">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-container border border-white/5 hover:border-white/15 transition-all"
                >
                  {entry.movie.posterUrl ? (
                    <img
                      src={entry.movie.posterUrl}
                      alt=""
                      className="w-14 h-20 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-20 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Film size={18} className="text-on-surface-variant" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/movie/${entry.movie.slug}`}
                      className="block text-white font-semibold text-sm md:text-base truncate hover:text-primary transition-colors"
                    >
                      {entry.movie.title}
                    </Link>
                    <div className="flex items-center gap-3 text-on-surface-variant text-xs mt-1">
                      {entry.movie.year && <span>{entry.movie.year}</span>}
                      {entry.movie.duration && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {formatDuration(entry.movie.duration)}
                        </span>
                      )}
                      <ProviderBadge provider="veyra" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/watch/${entry.movie.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90"
                    >
                      <Film size={13} /> Watch
                    </Link>
                    <button
                      onClick={() => handleRemoveCatalog(entry.movie.id)}
                      aria-label={`Remove ${entry.movie.title}`}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-on-surface-variant hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {empty && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
              <Bookmark size={30} className="text-on-surface-variant" />
            </div>
            <h2 className="font-headline-md text-xl text-white mb-2">Nothing saved yet</h2>
            <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-6">
              Tap <strong className="text-white">My List</strong> on any title. Public-domain films
              from the Internet Archive can also be downloaded for offline watching.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold"
              >
                Find something
              </Link>
              <Link
                href="/downloads"
                className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10"
              >
                <Download size={15} /> Downloads
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
