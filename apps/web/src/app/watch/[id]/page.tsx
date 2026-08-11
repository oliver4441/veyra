'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { api, type Movie } from '@/lib/api';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const movieId = parseInt(params.id as string);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState('1080');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get streaming URL
        const streamData = await api.getStreamingUrl(movieId, quality);
        setStreamingUrl(streamData.streamingUrl);

        // Get movie details
        // Note: We'd need to get the slug from the URL or fetch by ID
        // For now, we'll use the movie ID
      } catch (err: any) {
        setError(err.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    if (movieId) {
      fetchData();
    }
  }, [movieId, quality]);

  // Save watch progress periodically
  useEffect(() => {
    if (!videoRef.current || !movieId) return;

    const saveProgress = async () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        try {
          await api.updateWatchProgress({
            movieId,
            position: Math.floor(video.currentTime),
            duration: Math.floor(video.duration),
          });
        } catch {
          // Silently fail - don't interrupt playback
        }
      }
    };

    const interval = setInterval(saveProgress, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [movieId]);

  // Save progress on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (videoRef.current && movieId) {
        const video = videoRef.current;
        if (video.currentTime > 0) {
          // Use sendBeacon for reliable delivery during page unload
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
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [movieId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">Playback Error</h1>
        <p className="text-on-surface-variant mb-6">{error}</p>
        <Link href="/" className="btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Video Player */}
      <div className="relative w-full h-screen">
        {streamingUrl ? (
          <video
            ref={videoRef}
            src={streamingUrl}
            className="w-full h-full"
            controls
            autoPlay
            playsInline
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-on-surface-variant">Loading video...</p>
            </div>
          </div>
        )}

        {/* Back button overlay */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Quality selector overlay */}
        <div className="absolute top-4 right-4 z-10">
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="glass-panel text-white px-3 py-2 rounded-lg bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="480">480p</option>
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </div>
      </div>
    </div>
  );
}
