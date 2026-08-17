'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoPlayer from '@/components/VideoPlayer';
import { api, type Movie } from '@/lib/api';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const movieId = parseInt(params.id as string);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState('1080');
  const [initialPosition, setInitialPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch movie details + streaming URL ─────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [streamData, progressData] = await Promise.allSettled([
          api.getStreamingUrl(movieId, quality),
          api.getWatchProgress(),
        ]);

        if (streamData.status === 'fulfilled') {
          setStreamingUrl(streamData.value.streamingUrl);
        } else {
          throw new Error(streamData.reason?.message || 'Failed to load video');
        }

        // Restore watch progress
        if (progressData.status === 'fulfilled') {
          const progress = progressData.value.progress.find(
            (p) => p.movieId === movieId && !p.completed
          );
          if (progress && progress.position > 0) {
            setInitialPosition(progress.position);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    if (movieId) fetchData();
  }, [movieId, quality]);

  // ── Fetch movie metadata for the title overlay ──────────────
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        // Try to get movie by ID through the search endpoint
        const res = await api.getMovies({ limit: 50 });
        const found = res.movies.find((m) => m.id === movieId);
        if (found) setMovie(found);
      } catch {
        // Movie info not critical for playback
      }
    };
    if (movieId) fetchMovie();
  }, [movieId]);

  // ── Progress saving callback ────────────────────────────────
  const handleProgress = useCallback(
    async (position: number, duration: number) => {
      if (!movieId || position <= 0) return;
      try {
        await api.updateWatchProgress({
          movieId,
          position,
          duration,
        });
      } catch {
        // Silently fail — don't interrupt playback
      }
    },
    [movieId]
  );

  // ── Quality change handler ──────────────────────────────────
  const handleQualityChange = useCallback((q: string) => {
    // Save current position before switching
    const video = document.querySelector('video');
    const currentPosition = video?.currentTime || 0;
    setInitialPosition(currentPosition);
    setQuality(q);
  }, []);

  // ── Back navigation ────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (movie?.slug) {
      router.push(`/movie/${movie.slug}`);
    } else {
      router.back();
    }
  }, [movie, router]);

  // ── Save progress on unload ────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = document.querySelector('video');
      if (video && movieId && video.currentTime > 0) {
        const data = JSON.stringify({
          movieId,
          position: Math.floor(video.currentTime),
          duration: Math.floor(video.duration),
        });
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/watch/progress`,
          new Blob([data], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [movieId]);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <span className="text-5xl">⚠️</span>
        <h1 className="text-2xl font-bold text-white">Playback Error</h1>
        <p className="text-on-surface-variant text-center max-w-md">{error}</p>
        <Link
          href={movie?.slug ? `/movie/${movie.slug}` : '/'}
          className="bg-primary text-on-primary px-6 py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
        >
          {movie?.slug ? 'Back to Movie' : 'Back to Home'}
        </Link>
      </div>
    );
  }

  // ── Player ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black">
      {streamingUrl ? (
        <VideoPlayer
          src={streamingUrl}
          title={movie?.title}
          posterUrl={movie?.backdropUrl || movie?.posterUrl}
          quality={quality}
          onQualityChange={handleQualityChange}
          qualities={['480', '720', '1080']}
          onProgress={handleProgress}
          initialPosition={initialPosition}
          onBack={handleBack}
        />
      ) : (
        <div className="w-full h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-on-surface-variant">Loading video...</p>
          </div>
        </div>
      )}
    </div>
  );
}
