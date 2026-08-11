'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  ArrowLeft,
  Upload,
  Film,
  Image,
  Video,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { api, type Movie, type Genre } from '@/lib/api';
import { storageService } from '@/lib/storage';

interface MovieFormData {
  title: string;
  description: string;
  shortDescription: string;
  type: 'movie' | 'series';
  year: number | null;
  duration: number | null;
  rating: string;
  imdbRating: number | null;
  director: string;
  cast: string[];
  tags: string[];
  genreIds: number[];
  availableQualities: string[];
  status: 'draft' | 'published';
}

interface FileUpload {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
  url: string | null;
  error: string | null;
}

export default function AdminMoviesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  
  // Form data
  const [formData, setFormData] = useState<MovieFormData>({
    title: '',
    description: '',
    shortDescription: '',
    type: 'movie',
    year: new Date().getFullYear(),
    duration: null,
    rating: 'PG-13',
    imdbRating: null,
    director: '',
    cast: [],
    tags: [],
    genreIds: [],
    availableQualities: ['480', '720', '1080'],
    status: 'draft',
  });

  // File uploads
  const [posterUpload, setPosterUpload] = useState<FileUpload>({
    file: null,
    preview: null,
    uploading: false,
    uploaded: false,
    url: null,
    error: null,
  });
  const [backdropUpload, setBackdropUpload] = useState<FileUpload>({
    file: null,
    preview: null,
    uploading: false,
    uploaded: false,
    url: null,
    error: null,
  });
  const [videoUpload, setVideoUpload] = useState<FileUpload>({
    file: null,
    preview: null,
    uploading: false,
    uploaded: false,
    url: null,
    error: null,
  });

  // Refs for file inputs
  const posterInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch genres
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await api.getGenres();
        setGenres(response.genres);
      } catch (err) {
        console.error('Failed to fetch genres:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGenres();
  }, []);

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle number input changes
  const handleNumberChange = (name: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  // Handle genre selection
  const handleGenreToggle = (genreId: number) => {
    setFormData((prev) => ({
      ...prev,
      genreIds: prev.genreIds.includes(genreId)
        ? prev.genreIds.filter((id) => id !== genreId)
        : [...prev.genreIds, genreId],
    }));
  };

  // Handle cast input
  const handleCastInput = (value: string) => {
    const castArray = value.split(',').map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      cast: castArray,
    }));
  };

  // Handle tags input
  const handleTagsInput = (value: string) => {
    const tagsArray = value.split(',').map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      tags: tagsArray,
    }));
  };

  // Handle file selection
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: 'poster' | 'backdrop' | 'video'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (fileType === 'video' && !file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }
    if ((fileType === 'poster' || fileType === 'backdrop') && !file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Create preview
    const preview = URL.createObjectURL(file);

    if (fileType === 'poster') {
      setPosterUpload({
        file,
        preview,
        uploading: false,
        uploaded: false,
        url: null,
        error: null,
      });
    } else if (fileType === 'backdrop') {
      setBackdropUpload({
        file,
        preview,
        uploading: false,
        uploaded: false,
        url: null,
        error: null,
      });
    } else if (fileType === 'video') {
      setVideoUpload({
        file,
        preview: null,
        uploading: false,
        uploaded: false,
        url: null,
        error: null,
      });
    }
  };

  // Upload file to R2
  const uploadFile = async (
    file: File,
    fileType: 'poster' | 'backdrop' | 'video',
    movieId?: number
  ): Promise<string | null> => {
    try {
      const metadata: Record<string, string> = {};
      if (movieId) {
        metadata.movieId = String(movieId);
      }
      metadata.type = fileType;
      metadata.quality = fileType === 'video' ? '1080' : 'original';

      const result = await storageService.uploadFile(
        fileType === 'video' ? 'movie' : 'image',
        file,
        metadata
      );

      return result.url;
    } catch (err: any) {
      console.error(`Failed to upload ${fileType}:`, err);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.title) {
      setError('Title is required');
      return;
    }

    setSaving(true);

    try {
      // Create movie first
      const movieResponse = await api.request<{ movie: Movie }>('/api/admin/movies', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          posterUrl: posterUpload.url,
          backdropUrl: backdropUpload.url,
          trailerUrl: videoUpload.url,
        }),
      });

      const movieId = movieResponse.movie.id;

      // Upload files if selected
      if (posterUpload.file && !posterUpload.uploaded) {
        setPosterUpload((prev) => ({ ...prev, uploading: true }));
        const posterUrl = await uploadFile(posterUpload.file, 'poster', movieId);
        if (posterUrl) {
          setPosterUpload((prev) => ({
            ...prev,
            uploading: false,
            uploaded: true,
            url: posterUrl,
          }));
          // Update movie with poster URL
          await api.request(`/api/admin/movies/${movieId}`, {
            method: 'PUT',
            body: JSON.stringify({ posterUrl }),
          });
        } else {
          setPosterUpload((prev) => ({
            ...prev,
            uploading: false,
            error: 'Failed to upload poster',
          }));
        }
      }

      if (backdropUpload.file && !backdropUpload.uploaded) {
        setBackdropUpload((prev) => ({ ...prev, uploading: true }));
        const backdropUrl = await uploadFile(backdropUpload.file, 'backdrop', movieId);
        if (backdropUrl) {
          setBackdropUpload((prev) => ({
            ...prev,
            uploading: false,
            uploaded: true,
            url: backdropUrl,
          }));
          // Update movie with backdrop URL
          await api.request(`/api/admin/movies/${movieId}`, {
            method: 'PUT',
            body: JSON.stringify({ backdropUrl }),
          });
        } else {
          setBackdropUpload((prev) => ({
            ...prev,
            uploading: false,
            error: 'Failed to upload backdrop',
          }));
        }
      }

      if (videoUpload.file && !videoUpload.uploaded) {
        setVideoUpload((prev) => ({ ...prev, uploading: true }));
        const videoUrl = await uploadFile(videoUpload.file, 'video', movieId);
        if (videoUrl) {
          setVideoUpload((prev) => ({
            ...prev,
            uploading: false,
            uploaded: true,
            url: videoUrl,
          }));
          // Update movie with trailer URL
          await api.request(`/api/admin/movies/${movieId}`, {
            method: 'PUT',
            body: JSON.stringify({ trailerUrl: videoUrl }),
          });
        } else {
          setVideoUpload((prev) => ({
            ...prev,
            uploading: false,
            error: 'Failed to upload video',
          }));
        }
      }

      setSuccess('Movie created successfully!');
      
      // Reset form after delay
      setTimeout(() => {
        setFormData({
          title: '',
          description: '',
          shortDescription: '',
          type: 'movie',
          year: new Date().getFullYear(),
          duration: null,
          rating: 'PG-13',
          imdbRating: null,
          director: '',
          cast: [],
          tags: [],
          genreIds: [],
          availableQualities: ['480', '720', '1080'],
          status: 'draft',
        });
        setPosterUpload({
          file: null,
          preview: null,
          uploading: false,
          uploaded: false,
          url: null,
          error: null,
        });
        setBackdropUpload({
          file: null,
          preview: null,
          uploading: false,
          uploaded: false,
          url: null,
          error: null,
        });
        setVideoUpload({
          file: null,
          preview: null,
          uploading: false,
          uploaded: false,
          url: null,
          error: null,
        });
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create movie');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-20 pb-32 px-4 md:px-16 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/storage"
            className="p-2 rounded-lg hover:bg-surface-container transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-headline-md text-2xl font-bold">Add New Movie</h1>
            <p className="text-on-surface-variant text-sm">
              Upload a new movie or series to your library
            </p>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-error-container/20 border border-error/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-error" />
            <span className="text-error">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-error hover:text-error/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success-container/20 border border-success/30 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-success">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-headline-md text-lg font-bold mb-6 flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Enter movie title"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium mb-2">Year</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year || ''}
                  onChange={(e) => handleNumberChange('year', e.target.value)}
                  className="input-field"
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear() + 5}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration || ''}
                  onChange={(e) => handleNumberChange('duration', e.target.value)}
                  className="input-field"
                  placeholder="7200"
                  min="0"
                />
                <p className="text-xs text-on-surface-variant mt-1">
                  {formData.duration
                    ? `${Math.floor(formData.duration / 3600)}h ${Math.floor(
                        (formData.duration % 3600) / 60
                      )}m`
                    : 'Enter duration in seconds'}
                </p>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <select
                  name="rating"
                  value={formData.rating}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="G">G</option>
                  <option value="PG">PG</option>
                  <option value="PG-13">PG-13</option>
                  <option value="R">R</option>
                  <option value="NC-17">NC-17</option>
                  <option value="TV-MA">TV-MA</option>
                  <option value="TV-14">TV-14</option>
                </select>
              </div>

              {/* IMDB Rating */}
              <div>
                <label className="block text-sm font-medium mb-2">IMDB Rating</label>
                <input
                  type="number"
                  name="imdbRating"
                  value={formData.imdbRating || ''}
                  onChange={(e) => handleNumberChange('imdbRating', e.target.value)}
                  className="input-field"
                  placeholder="8.5"
                  min="0"
                  max="10"
                  step="0.1"
                />
              </div>

              {/* Director */}
              <div>
                <label className="block text-sm font-medium mb-2">Director</label>
                <input
                  type="text"
                  name="director"
                  value={formData.director}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Director name"
                />
              </div>

              {/* Cast */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Cast (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.cast.join(', ')}
                  onChange={(e) => handleCastInput(e.target.value)}
                  className="input-field"
                  placeholder="Actor 1, Actor 2, Actor 3"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input-field min-h-[120px]"
                  placeholder="Enter movie description"
                />
              </div>

              {/* Short Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Short Description (max 300 chars)
                </label>
                <textarea
                  name="shortDescription"
                  value={formData.shortDescription}
                  onChange={handleInputChange}
                  className="input-field min-h-[80px]"
                  placeholder="Brief description for previews"
                  maxLength={300}
                />
                <p className="text-xs text-on-surface-variant mt-1">
                  {formData.shortDescription.length}/300 characters
                </p>
              </div>

              {/* Tags */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => handleTagsInput(e.target.value)}
                  className="input-field"
                  placeholder="action, thriller, 2024"
                />
              </div>
            </div>
          </div>

          {/* Genres */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-headline-md text-lg font-bold mb-6">Genres</h2>
            <div className="flex flex-wrap gap-3">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => handleGenreToggle(genre.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    formData.genreIds.includes(genre.id)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface hover:bg-surface-variant'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
            {genres.length === 0 && (
              <p className="text-on-surface-variant text-sm">
                No genres available. Create genres in the database first.
              </p>
            )}
          </div>

          {/* File Uploads */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-headline-md text-lg font-bold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Media Files
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Poster Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Poster Image</label>
                <div
                  onClick={() => posterInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-primary ${
                    posterUpload.uploaded
                      ? 'border-success bg-success-container/10'
                      : posterUpload.error
                      ? 'border-error bg-error-container/10'
                      : 'border-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'poster')}
                    className="hidden"
                  />

                  {posterUpload.preview ? (
                    <div className="relative">
                      <img
                        src={posterUpload.preview}
                        alt="Poster preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {posterUpload.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                      )}
                      {posterUpload.uploaded && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-6 h-6 text-success" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8">
                      <Image className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
                      <p className="text-sm text-on-surface-variant">
                        Click to upload poster
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        PNG, JPG up to 5MB
                      </p>
                    </div>
                  )}
                </div>
                {posterUpload.error && (
                  <p className="text-xs text-error mt-2">{posterUpload.error}</p>
                )}
              </div>

              {/* Backdrop Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Backdrop Image</label>
                <div
                  onClick={() => backdropInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-primary ${
                    backdropUpload.uploaded
                      ? 'border-success bg-success-container/10'
                      : backdropUpload.error
                      ? 'border-error bg-error-container/10'
                      : 'border-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <input
                    ref={backdropInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'backdrop')}
                    className="hidden"
                  />

                  {backdropUpload.preview ? (
                    <div className="relative">
                      <img
                        src={backdropUpload.preview}
                        alt="Backdrop preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {backdropUpload.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                      )}
                      {backdropUpload.uploaded && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-6 h-6 text-success" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8">
                      <Image className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
                      <p className="text-sm text-on-surface-variant">
                        Click to upload backdrop
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  )}
                </div>
                {backdropUpload.error && (
                  <p className="text-xs text-error mt-2">{backdropUpload.error}</p>
                )}
              </div>

              {/* Video Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Trailer / Video
                </label>
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-primary ${
                    videoUpload.uploaded
                      ? 'border-success bg-success-container/10'
                      : videoUpload.error
                      ? 'border-error bg-error-container/10'
                      : 'border-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileSelect(e, 'video')}
                    className="hidden"
                  />

                  {videoUpload.file ? (
                    <div className="py-8">
                      <Video className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
                      <p className="text-sm text-on-surface-variant truncate">
                        {videoUpload.file.name}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {(videoUpload.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {videoUpload.uploading && (
                        <div className="mt-2">
                          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                          <p className="text-xs text-primary mt-1">Uploading...</p>
                        </div>
                      )}
                      {videoUpload.uploaded && (
                        <CheckCircle className="w-6 h-6 text-success mx-auto mt-2" />
                      )}
                    </div>
                  ) : (
                    <div className="py-8">
                      <Video className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
                      <p className="text-sm text-on-surface-variant">
                        Click to upload video
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        MP4, WebM up to 2GB
                      </p>
                    </div>
                  )}
                </div>
                {videoUpload.error && (
                  <p className="text-xs text-error mt-2">{videoUpload.error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-headline-md text-lg font-bold mb-6">Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {/* Available Qualities */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Available Qualities
                </label>
                <div className="flex flex-wrap gap-2">
                  {['480', '720', '1080', '4K'].map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          availableQualities: prev.availableQualities.includes(quality)
                            ? prev.availableQualities.filter((q) => q !== quality)
                            : [...prev.availableQualities, quality],
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        formData.availableQualities.includes(quality)
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface hover:bg-surface-variant'
                      }`}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Link
              href="/admin/storage"
              className="px-6 py-3 rounded-xl font-medium hover:bg-surface-container transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || posterUpload.uploading || backdropUpload.uploading || videoUpload.uploading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Movie
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
