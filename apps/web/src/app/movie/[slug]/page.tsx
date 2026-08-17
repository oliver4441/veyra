'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Play, Bookmark, Share2, Clock, Calendar, Star, Send, Trash2, User, Check } from 'lucide-react';
import { api, type Movie } from '@/lib/api';
import { useUser } from '@/lib/use-user';

interface MovieRating {
  id: number;
  rating: number;
  review?: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface RatingStats {
  average: number;
  total: number;
}

export default function MovieDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user: authUser } = useUser();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  // Ratings state
  const [ratings, setRatings] = useState<MovieRating[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ average: 0, total: 0 });
  const [userRating, setUserRating] = useState<{ id: number; rating: number; review?: string } | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const { movie: data } = await api.getMovie(slug);
        setMovie(data);
      } catch {
        setError('Movie not found');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchMovie();
  }, [slug]);

  useEffect(() => {
    if (!movie) return;
    const fetchRatings = async () => {
      try {
        const data = await api.getMovieRatings(movie.id);
        setRatings(data.ratings);
        setRatingStats(data.stats);
        setUserRating(data.userRating);
        if (data.userRating) {
          setMyRating(data.userRating.rating);
          setMyReview(data.userRating.review || '');
        }
      } catch {
        // Ratings not available
      }
    };
    fetchRatings();
  }, [movie]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const handleSubmitRating = async () => {
    if (!movie || myRating === 0) return;
    setSubmitting(true);
    try {
      await api.submitRating({ movieId: movie.id, rating: myRating, review: myReview || undefined });
      const data = await api.getMovieRatings(movie.id);
      setRatings(data.ratings);
      setRatingStats(data.stats);
      setUserRating(data.userRating);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!movie) return;
    try {
      await api.deleteRating(movie.id);
      setUserRating(null);
      setMyRating(0);
      setMyReview('');
      const data = await api.getMovieRatings(movie.id);
      setRatings(data.ratings);
      setRatingStats(data.stats);
    } catch (err) {
      console.error('Failed to delete rating:', err);
    }
  };

  const handleToggleWatchlist = async () => {
    if (!movie) return;
    try {
      if (inWatchlist) {
        await api.removeFromWatchlist(movie.id);
        setInWatchlist(false);
      } else {
        await api.addToWatchlist(movie.id);
        setInWatchlist(true);
      }
    } catch (err) {
      console.error('Watchlist error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <span className="text-5xl">🎬</span>
          <h1 className="text-2xl font-bold text-white">Movie Not Found</h1>
          <Link href="/" className="btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const rating = movie.voteAverage || movie.imdbRating;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero Backdrop ──────────────────────────────────────────── */}
      <div className="relative w-full h-[75vh] min-h-[500px] max-h-[800px]">
        {movie.backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${movie.backdropUrl}')` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-surface" />
        )}

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background/80 to-transparent" />
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 md:px-16 pb-10 md:pb-14">
          <div className="max-w-4xl">
            {/* Title */}
            <h1 className="font-display-xl text-4xl md:text-6xl lg:text-7xl text-white mb-4 drop-shadow-2xl">
              {movie.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {rating && (
                <div className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                  <Star size={15} className="text-yellow-400" fill="currentColor" />
                  <span className="text-white font-bold text-sm">{rating}</span>
                  <span className="text-on-surface-variant text-xs">/10</span>
                  {ratingStats.total > 0 && (
                    <span className="text-on-surface-variant text-xs">({ratingStats.total})</span>
                  )}
                </div>
              )}
              {movie.year && (
                <span className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <Calendar size={14} />
                  {movie.year}
                </span>
              )}
              {movie.duration && (
                <span className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <Clock size={14} />
                  {formatDuration(movie.duration)}
                </span>
              )}
              {movie.rating && (
                <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-bold rounded border border-white/20 uppercase tracking-wider">
                  {movie.rating}
                </span>
              )}
              {movie.type === 'series' && (
                <span className="px-2.5 py-1 bg-primary/20 text-primary text-xs font-bold rounded border border-primary/30">
                  Series
                </span>
              )}
              {movie.originalLanguage && (
                <span className="text-on-surface-variant text-xs">
                  {movie.originalLanguage.toUpperCase()}
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/?genre=${genre.id}`}
                    className="px-3 py-1.5 bg-white/5 backdrop-blur-sm text-on-surface-variant text-xs font-medium rounded-full border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-on-surface-variant text-base md:text-lg mb-6 max-w-2xl leading-relaxed">
              {movie.description || movie.shortDescription}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/watch/${movie.id}`}
                className="group flex items-center gap-2.5 bg-white text-black font-bold px-7 py-3.5 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10"
              >
                <Play size={22} fill="black" className="text-black" />
                <span>Play</span>
              </Link>
              {authUser && (
                <button
                  onClick={handleToggleWatchlist}
                  className={`flex items-center gap-2.5 backdrop-blur-sm font-bold px-6 py-3.5 rounded-lg border transition-all duration-200 ${
                    inWatchlist
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  {inWatchlist ? <Check size={20} /> : <Bookmark size={20} />}
                  {inWatchlist ? 'In Watchlist' : 'Watchlist'}
                </button>
              )}
              <button className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm text-white font-bold px-6 py-3.5 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200">
                <Share2 size={20} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Details Section ────────────────────────────────────────── */}
      <main className="relative z-20 px-5 md:px-16 py-10 md:py-14">
        <div className="max-w-4xl space-y-10">

          {/* Director & Cast */}
          {(movie.director || (movie.cast && movie.cast.length > 0)) && (
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movie.director && (
                  <div className="p-4 bg-surface-container rounded-xl">
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">Director</span>
                    <span className="text-white font-medium">{movie.director}</span>
                  </div>
                )}
                {movie.cast && movie.cast.length > 0 && (
                  <div className="p-4 bg-surface-container rounded-xl">
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">Cast</span>
                    <span className="text-white font-medium">{movie.cast.join(', ')}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Trailer */}
          {movie.trailerUrl && (
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Trailer</h2>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/5">
                <iframe
                  src={`https://www.youtube.com/embed/${
                    movie.trailerUrl.includes('v=')
                      ? movie.trailerUrl.split('v=')[1]?.split('&')[0]
                      : movie.trailerUrl.includes('youtu.be/')
                        ? movie.trailerUrl.split('youtu.be/')[1]?.split('?')[0]
                        : movie.trailerUrl
                  }`}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}

          {/* TMDB Metadata */}
          {movie.tmdbId && (
            <section className="p-4 bg-surface-container rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-on-surface-variant text-xs mb-1">TMDB Metadata</p>
                  <p className="text-white text-sm">
                    ID: {movie.tmdbId} · {movie.tmdbMediaType === 'tv' ? 'TV Show' : 'Movie'}
                    {movie.releaseDate ? ` · Released ${movie.releaseDate}` : ''}
                  </p>
                </div>
                <a
                  href={`https://www.themoviedb.org/${movie.tmdbMediaType || 'movie'}/${movie.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline font-medium"
                >
                  View on TMDB →
                </a>
              </div>
            </section>
          )}

          {/* ── Ratings & Reviews ───────────────────────────────────── */}
          <section>
            <h2 className="font-headline-md text-xl text-white mb-6">
              Ratings & Reviews
              {ratingStats.total > 0 && (
                <span className="text-on-surface-variant text-sm font-normal ml-2">
                  ({ratingStats.total})
                </span>
              )}
            </h2>

            {/* Rating Stats */}
            {ratingStats.total > 0 && (
              <div className="flex items-center gap-8 p-6 bg-surface-container rounded-xl mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">{ratingStats.average}</div>
                  <div className="text-on-surface-variant text-xs mt-0.5">/10</div>
                </div>
                <div className="flex-1">
                  <p className="text-on-surface-variant text-sm mb-3">
                    {ratingStats.total} rating{ratingStats.total !== 1 ? 's' : ''}
                  </p>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((star) => {
                    const count = ratings.filter((r) => Math.round(r.rating) === star).length;
                    const pct = ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 mb-1">
                        <span className="text-on-surface-variant text-xs w-3 text-right">{star}</span>
                        <Star size={10} className="text-primary shrink-0" fill="currentColor" />
                        <div className="flex-1 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-on-surface-variant text-xs w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Write a Review */}
            {authUser ? (
              <div className="p-5 bg-surface-container rounded-xl mb-6">
                <h3 className="text-white font-semibold mb-4">
                  {userRating ? 'Edit Your Review' : 'Write a Review'}
                </h3>

                {/* Star selector */}
                <div className="flex items-center gap-1 mb-4">
                  <span className="text-on-surface-variant text-sm mr-2">Your rating:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      onClick={() => setMyRating(star)}
                      className={`p-0.5 transition-all duration-150 hover:scale-125 ${
                        star <= myRating ? 'text-primary' : 'text-surface-variant hover:text-primary/50'
                      }`}
                    >
                      <Star size={22} fill={star <= myRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                  {myRating > 0 && (
                    <span className="text-primary font-bold ml-2">{myRating}/10</span>
                  )}
                </div>

                {/* Review text */}
                <textarea
                  value={myReview}
                  onChange={(e) => setMyReview(e.target.value)}
                  placeholder="Write your thoughts (optional)..."
                  className="w-full bg-surface-variant text-white rounded-lg p-3 text-sm resize-none h-24 border border-white/5 focus:border-primary/50 focus:outline-none transition-colors"
                />

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleSubmitRating}
                    disabled={myRating === 0 || submitting}
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <Send size={14} />
                    {submitting ? 'Submitting...' : userRating ? 'Update Review' : 'Submit Review'}
                  </button>
                  {userRating && (
                    <button
                      onClick={handleDeleteRating}
                      className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 bg-surface-container rounded-xl text-center mb-6">
                <p className="text-on-surface-variant text-sm">
                  <Link href="/auth" className="text-primary hover:underline font-medium">Sign in</Link>
                  {' '}to rate and review this title.
                </p>
              </div>
            )}

            {/* Reviews List */}
            {ratings.length > 0 ? (
              <div className="space-y-3">
                {ratings.map((r) => (
                  <div key={r.id} className="p-5 bg-surface-container rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      {r.avatarUrl ? (
                        <img src={r.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center">
                          <User size={16} className="text-on-surface-variant" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {r.displayName || r.username}
                        </p>
                        <p className="text-on-surface-variant text-xs">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Star size={14} fill="currentColor" />
                        <span className="font-bold text-sm">{r.rating}</span>
                        <span className="text-on-surface-variant text-xs">/10</span>
                      </div>
                    </div>
                    {r.review && (
                      <p className="text-on-surface-variant text-sm leading-relaxed">
                        {r.review}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Star size={40} className="text-surface-variant mx-auto mb-3" />
                <p className="text-on-surface-variant text-sm">
                  No reviews yet. Be the first to rate this title!
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
