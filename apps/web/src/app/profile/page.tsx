'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { User, Star, Edit3, Save, X, Film, Clock, Bookmark, Loader2, LogOut } from 'lucide-react';
import { api, type Movie } from '@/lib/api';
import { auth } from '@/lib/firebase';

interface UserProfile {
  id: number;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  createdAt?: string;
}

interface UserRating {
  id: number;
  rating: number;
  review?: string;
  createdAt: string;
  movie: {
    id: number;
    title: string;
    slug: string;
    posterUrl?: string;
    year?: number;
    type: string;
  };
}

interface WatchlistItem {
  id: number;
  addedAt: string;
  movie: Movie;
}

interface ContinueWatchingItem {
  movieId: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
}

type TabKey = 'ratings' | 'watchlist' | 'history';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('ratings');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { user: u } = await api.getMe();
        setUser(u);
        setDisplayName(u.displayName || u.username);

        const [ratingsRes, watchlistRes, progressRes] = await Promise.allSettled([
          api.getUserRatings(),
          api.getWatchlist(),
          api.getWatchProgress(),
        ]);

        if (ratingsRes.status === 'fulfilled') setRatings(ratingsRes.value.ratings);
        if (watchlistRes.status === 'fulfilled') setWatchlist(watchlistRes.value.watchlist);

        if (progressRes.status === 'fulfilled') {
          const incomplete = progressRes.value.progress
            .filter((p) => !p.completed && p.movieId)
            .reduce<ContinueWatchingItem[]>((acc, p) => {
              if (!acc.find((a) => a.movieId === p.movieId)) {
                acc.push({
                  movieId: p.movieId!,
                  position: p.position,
                  duration: p.duration,
                  completed: p.completed,
                  updatedAt: p.updatedAt,
                });
              }
              return acc;
            }, []);

          if (incomplete.length > 0) {
            const allMovies = await api.getMovies({ limit: 50 });
            setContinueWatching(
              incomplete.map((item) => ({
                ...item,
                movie: allMovies.movies.find((m) => m.id === item.movieId),
              }))
            );
          }
        }
      } catch {
        router.push('/auth');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { user: updated } = await api.updateProfile({ displayName });
      setUser(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const initials = user?.displayName
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || user?.username?.slice(0, 2).toUpperCase() || 'U';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-5 md:px-16 py-12">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 rounded-full bg-surface-container animate-pulse" />
            <div className="space-y-3">
              <div className="h-6 w-40 bg-surface-container rounded animate-pulse" />
              <div className="h-4 w-32 bg-surface-container rounded animate-pulse" />
              <div className="h-4 w-48 bg-surface-container rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-surface-container rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tabs: { key: TabKey; label: string; icon: typeof Star; count: number }[] = [
    { key: 'ratings', label: 'Reviews', icon: Star, count: ratings.length },
    { key: 'watchlist', label: 'Watchlist', icon: Bookmark, count: watchlist.length },
    { key: 'history', label: 'In Progress', icon: Clock, count: continueWatching.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-5 md:px-16 py-12">
        {/* ── Profile Header ──────────────────────────────────── */}
        <div className="mb-8 p-6 md:p-8 bg-surface-container rounded-2xl border border-white/5">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative group">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                  <span className="text-2xl font-bold text-primary">{initials}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-on-surface-variant text-xs block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-surface-variant text-white rounded-lg px-3 py-2.5 text-sm border border-white/10 focus:border-primary/50 focus:outline-none transition-colors"
                      placeholder="Your display name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setDisplayName(user.displayName || user.username);
                      }}
                      className="flex items-center gap-1.5 bg-surface-container-high text-on-surface-variant px-4 py-2 rounded-lg text-sm font-medium hover:text-white transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white truncate">
                      {user.displayName || user.username}
                    </h1>
                    <span className="px-2.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-on-surface-variant text-sm mb-0.5">@{user.username}</p>
                  <p className="text-on-surface-variant text-sm">{user.email}</p>
                  {user.createdAt && (
                    <p className="text-on-surface-variant/60 text-xs mt-2">
                      Member since {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 bg-surface-container-high text-on-surface-variant px-4 py-2 rounded-lg text-sm font-medium hover:text-white transition-colors"
                    >
                      <Edit3 size={14} />
                      Edit Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1.5 text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`p-4 rounded-xl text-center transition-all duration-200 border ${
                  activeTab === tab.key
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-surface-container border-white/5 hover:border-white/10'
                }`}
              >
                <Icon
                  size={20}
                  className={`mx-auto mb-2 ${
                    activeTab === tab.key ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                />
                <div
                  className={`text-2xl font-bold ${
                    activeTab === tab.key ? 'text-primary' : 'text-white'
                  }`}
                >
                  {tab.count}
                </div>
                <div className="text-on-surface-variant text-xs mt-0.5">{tab.label}</div>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <div className="min-h-[200px]">
          {/* Reviews Tab */}
          {activeTab === 'ratings' && (
            <div>
              {ratings.length === 0 ? (
                <EmptyState
                  icon={<Star size={48} />}
                  title="No reviews yet"
                  description="Rate and review movies you've watched."
                  action={{ label: 'Browse Titles', href: '/browse' }}
                />
              ) : (
                <div className="space-y-2">
                  {ratings.map((r) => (
                    <Link
                      key={r.id}
                      href={`/movie/${r.movie.slug}`}
                      className="flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group"
                    >
                      {r.movie.posterUrl ? (
                        <img
                          src={r.movie.posterUrl}
                          alt=""
                          className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-surface-variant rounded-lg flex items-center justify-center flex-shrink-0">
                          <Film size={18} className="text-on-surface-variant" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate group-hover:text-primary transition-colors">
                          {r.movie.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-0.5 text-primary">
                            <Star size={12} fill="currentColor" />
                            <span className="text-sm font-bold">{r.rating}</span>
                          </div>
                          {r.movie.year && (
                            <span className="text-on-surface-variant text-xs">{r.movie.year}</span>
                          )}
                        </div>
                        {r.review && (
                          <p className="text-on-surface-variant text-xs mt-1 line-clamp-1">
                            {r.review}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Watchlist Tab */}
          {activeTab === 'watchlist' && (
            <div>
              {watchlist.length === 0 ? (
                <EmptyState
                  icon={<Bookmark size={48} />}
                  title="Your watchlist is empty"
                  description="Save movies and series you want to watch later."
                  action={{ label: 'Browse Titles', href: '/browse' }}
                />
              ) : (
                <div className="space-y-2">
                  {watchlist.map((item) => (
                    <Link
                      key={item.id}
                      href={`/movie/${item.movie.slug}`}
                      className="flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group"
                    >
                      {item.movie.posterUrl ? (
                        <img
                          src={item.movie.posterUrl}
                          alt=""
                          className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-surface-variant rounded-lg flex items-center justify-center flex-shrink-0">
                          <Film size={18} className="text-on-surface-variant" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate group-hover:text-primary transition-colors">
                          {item.movie.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {item.movie.year && (
                            <span className="text-on-surface-variant text-xs">{item.movie.year}</span>
                          )}
                          <span className="text-on-surface-variant/60 text-xs">
                            Added {new Date(item.addedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Continue Watching Tab */}
          {activeTab === 'history' && (
            <div>
              {continueWatching.length === 0 ? (
                <EmptyState
                  icon={<Clock size={48} />}
                  title="Nothing in progress"
                  description="Start watching a movie and it'll show up here."
                  action={{ label: 'Browse Titles', href: '/browse' }}
                />
              ) : (
                <div className="space-y-2">
                  {continueWatching.map((item) => {
                    const progressPct =
                      item.duration > 0
                        ? Math.min((item.position / item.duration) * 100, 100)
                        : 0;
                    const remaining = item.duration - item.position;
                    const hours = Math.floor(remaining / 3600);
                    const minutes = Math.floor((remaining % 3600) / 60);

                    return (
                      <Link
                        key={item.movieId}
                        href={`/movie/${item.movie?.slug || item.movieId}`}
                        className="flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group"
                      >
                        {item.movie?.posterUrl ? (
                          <img
                            src={item.movie.posterUrl}
                            alt=""
                            className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-16 bg-surface-variant rounded-lg flex items-center justify-center flex-shrink-0">
                            <Film size={18} className="text-on-surface-variant" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate group-hover:text-primary transition-colors">
                            {item.movie?.title || 'Unknown'}
                          </h3>
                          <div className="w-full bg-surface-variant rounded-full h-1.5 mt-2 overflow-hidden">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <p className="text-on-surface-variant text-xs mt-1.5">
                            {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} remaining
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-16">
      <div className="text-surface-variant mx-auto mb-4 opacity-50">{icon}</div>
      <h3 className="text-white font-semibold text-lg mb-1">{title}</h3>
      <p className="text-on-surface-variant text-sm mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
