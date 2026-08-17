'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  Maximize, Minimize, SkipBack, SkipForward,
  Settings, ChevronLeft, Loader2,
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  posterUrl?: string;
  quality?: string;
  onQualityChange?: (q: string) => void;
  qualities?: string[];
  onProgress?: (position: number, duration: number) => void;
  initialPosition?: number;
  onBack?: () => void;
}

export default function VideoPlayer({
  src,
  title,
  posterUrl,
  quality = '1080',
  onQualityChange,
  qualities = ['480', '720', '1080'],
  onProgress,
  initialPosition = 0,
  onBack,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const video = videoRef.current;

  // ── Format helpers ─────────────────────────────────────────────
  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── Play / Pause ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      if (!hasStarted) setHasStarted(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [video, hasStarted]);

  // ── Volume ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, [video]);

  const handleVolumeChange = useCallback((val: number) => {
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, val));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  }, [video]);

  // ── Seek ──────────────────────────────────────────────────────
  const seekTo = useCallback((time: number) => {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
    setCurrentTime(video.currentTime);
  }, [video]);

  const skip = useCallback((seconds: number) => {
    if (!video) return;
    seekTo(video.currentTime + seconds);
  }, [video, seekTo]);

  // ── Progress bar click/drag ───────────────────────────────────
  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !video) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * (video.duration || 0));
  }, [video, seekTo]);

  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !video) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * (video.duration || 0));
    setHoverX(e.clientX - rect.left);
  }, [video]);

  // ── Volume bar click ──────────────────────────────────────────
  const handleVolumeClick = useCallback((e: React.MouseEvent) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleVolumeChange(pct);
  }, [handleVolumeChange]);

  // ── Fullscreen ────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  // ── Playback rate ─────────────────────────────────────────────
  const cyclePlaybackRate = useCallback(() => {
    if (!video) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    video.playbackRate = next;
    setPlaybackRate(next);
  }, [video, playbackRate]);

  // ── Controls visibility ───────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    setShowSettings(false);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
      showControlsTemporarily();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, skip, volume, handleVolumeChange, toggleFullscreen, toggleMute, showControlsTemporarily]);

  // ── Video event listeners ─────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      onProgress?.(Math.floor(v.currentTime), Math.floor(v.duration || 0));
    };
    const onLoadedMetadata = () => {
      setDuration(v.duration);
      setIsBuffering(false);
      // Restore position
      if (initialPosition > 0 && initialPosition < v.duration * 0.95) {
        v.currentTime = initialPosition;
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onBufferProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onEnded = () => setIsPlaying(false);

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('progress', onBufferProgress);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('progress', onBufferProgress);
      v.removeEventListener('ended', onEnded);
    };
  }, [initialPosition, onProgress]);

  // ── Fullscreen change listener ────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Mouse move to show controls ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = () => showControlsTemporarily();
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [showControlsTemporarily]);

  // ── Progress percentages ──────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ── Volume icon ───────────────────────────────────────────────
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black select-none group cursor-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* ── Video Element ─────────────────────────────────────── */}
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* ── Buffering Spinner ─────────────────────────────────── */}
      {isBuffering && hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ── Big Center Play Button (before first play) ────────── */}
      {!hasStarted && !isBuffering && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-20"
        >
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-200 hover:scale-105">
            <Play size={36} className="text-white ml-2" fill="white" />
          </div>
        </button>
      )}

      {/* ── Big Center Play/Pause (tap while playing) ─────────── */}
      {showControls && hasStarted && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {/* Shown briefly on toggle */}
        </div>
      )}

      {/* ── Controls Overlay ──────────────────────────────────── */}
      <div
        className={`absolute inset-0 z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        {/* ── Top Bar ─────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 md:px-8 py-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
            <span className="text-sm font-medium hidden md:inline">Back</span>
          </button>

          {/* Title */}
          {title && (
            <h1 className="text-white font-semibold text-sm md:text-base truncate max-w-md mx-4">
              {title}
            </h1>
          )}

          {/* Spacer */}
          <div className="w-20" />
        </div>

        {/* ── Center Play/Pause Button ────────────────────────── */}
        {isBuffering ? null : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={togglePlay}
              className="pointer-events-auto w-16 h-16 md:w-18 md:h-18 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-150 hover:scale-105"
            >
              {isPlaying ? (
                <Pause size={30} className="text-white" fill="white" />
              ) : (
                <Play size={30} className="text-white ml-1" fill="white" />
              )}
            </button>
          </div>
        )}

        {/* ── Skip Buttons (visible on mobile) ────────────────── */}
        <div className="absolute inset-0 flex items-center justify-between px-8 md:hidden pointer-events-none">
          <button
            onClick={() => skip(-10)}
            className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <SkipBack size={20} className="text-white" />
          </button>
          <button
            onClick={() => skip(10)}
            className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <SkipForward size={20} className="text-white" />
          </button>
        </div>

        {/* ── Bottom Controls ─────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-4 md:pb-6">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="relative w-full h-6 md:h-8 flex items-center cursor-pointer group/progress mb-1"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Track background */}
            <div className="absolute left-0 right-0 h-1 md:h-1.5 bg-white/20 rounded-full group-hover/progress:h-2 md:group-hover/progress:h-2.5 transition-all duration-150">
              {/* Buffered */}
              <div
                className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* Progress */}
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-[height] duration-150"
                style={{ width: `${progressPct}%` }}
              />
              {/* Scrubber */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 bg-primary rounded-full shadow-lg shadow-primary/40 opacity-0 group-hover/progress:opacity-100 transition-opacity duration-150 pointer-events-none"
                style={{ left: `calc(${progressPct}% - 7px)` }}
              />
            </div>

            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 -translate-x-1/2 px-2 py-1 bg-surface-container/90 backdrop-blur-sm text-white text-xs rounded font-medium pointer-events-none"
                style={{ left: `${hoverX}px` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={20} fill="white" />
                ) : (
                  <Play size={20} className="ml-0.5" fill="white" />
                )}
              </button>

              {/* Skip back 10s */}
              <button
                onClick={() => skip(-10)}
                className="hidden md:flex w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack size={18} />
              </button>

              {/* Skip forward 10s */}
              <button
                onClick={() => skip(10)}
                className="hidden md:flex w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward size={18} />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  <VolumeIcon size={20} />
                </button>

                {/* Volume slider */}
                <div
                  ref={volumeRef}
                  className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200 cursor-pointer"
                  onClick={handleVolumeClick}
                >
                  <div className="relative h-1 bg-white/20 rounded-full mx-2">
                    <div
                      className="absolute top-0 left-0 h-full bg-white rounded-full"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Time display */}
              <div className="text-white/70 text-xs md:text-sm font-mono ml-2 hidden sm:block">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/40">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Playback speed */}
              <button
                onClick={cyclePlaybackRate}
                className="hidden md:flex h-8 px-2.5 rounded-md items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
                aria-label="Playback speed"
              >
                {playbackRate}x
              </button>

              {/* Settings */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Settings"
                >
                  <Settings size={18} />
                </button>

                {/* Settings dropdown */}
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 glass-panel border border-white/10 rounded-xl py-2 animate-slide-up">
                    {/* Quality */}
                    <div className="px-4 py-2">
                      <p className="text-on-surface-variant text-xs mb-2 uppercase tracking-wider font-medium">Quality</p>
                      <div className="space-y-1">
                        {qualities.map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              onQualityChange?.(q);
                              setShowSettings(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              quality === q
                                ? 'bg-primary/20 text-primary font-medium'
                                : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {q}p {q === '1080' ? 'HD' : q === '480' ? 'SD' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
