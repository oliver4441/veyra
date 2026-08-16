import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ==================== Enums ====================

export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'superadmin']);
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'series']);
export const rightsStatusEnum = pgEnum('rights_status', [
  'owned',
  'licensed',
  'public_domain',
  'creator_authorized',
  'pending_review',
  'blocked',
]);
export const mediaStatusEnum = pgEnum('media_status', ['draft', 'processing', 'published', 'archived']);
export const storageProviderEnum = pgEnum('storage_provider', [
  'cloudflare-r2',
  'terabox',
  'google-drive',
  'backblaze-b2',
  'dropbox',
  'mega',
  's3-compatible',
]);
export const storagePurposeEnum = pgEnum('storage_purpose', [
  'primary-media',
  'archive',
  'posters-artwork',
  'subtitles',
  'trailers',
  'backups',
  'hot-storage',
  'cold-storage',
  'general',
]);
export const storageHealthEnum = pgEnum('storage_health', [
  'connected',
  'disconnected',
  'auth-expired',
  'error',
  'rate-limited',
  'storage-full',
  'unavailable',
]);
export const qualityEnum = pgEnum('quality', ['480', '720', '1080', '4k']);

// ==================== Users & Auth ====================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== Movies & Series ====================

export const movies = pgTable('movies', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 300 }),
  type: mediaTypeEnum('type').default('movie').notNull(),
  year: integer('year'),
  duration: integer('duration'), // in seconds
  rating: varchar('rating', { length: 10 }), // PG-13, R, etc.
  imdbRating: real('imdb_rating'),
  director: varchar('director', { length: 255 }),
  cast: jsonb('cast').$type<string[]>(), // array of actor names
  tags: jsonb('tags').$type<string[]>(),
  posterUrl: text('poster_url'),
  backdropUrl: text('backdrop_url'),
  trailerUrl: text('trailer_url'),
  status: mediaStatusEnum('status').default('draft').notNull(),
  rightsStatus: rightsStatusEnum('rights_status').default('pending_review').notNull(),
  streamingEnabled: boolean('streaming_enabled').default(false).notNull(),
  downloadEnabled: boolean('download_enabled').default(false).notNull(),
  availableQualities: jsonb('available_qualities').$type<string[]>().default(['480', '720', '1080']),
  featured: boolean('featured').default(false),
  trending: boolean('trending').default(false),
  viewCount: integer('view_count').default(0),
  // ── TMDB Metadata Fields ──
  tmdbId: integer('tmdb_id'),
  tmdbMediaType: varchar('tmdb_media_type', { length: 10 }), // 'movie' or 'tv'
  originalTitle: varchar('original_title', { length: 255 }),
  originalLanguage: varchar('original_language', { length: 10 }),
  overview: text('overview'),
  releaseDate: varchar('release_date', { length: 20 }),
  voteAverage: real('vote_average'),
  voteCount: integer('vote_count'),
  popularity: real('popularity'),
  posterPath: varchar('poster_path', { length: 255 }),
  backdropPath: varchar('backdrop_path', { length: 255 }),
  genres: jsonb('genres').$type<string[]>(), // TMDB genre names
  productionCountries: jsonb('production_countries').$type<string[]>(),
  spokenLanguages: jsonb('spoken_languages').$type<string[]>(),
  statusTmdb: varchar('status_tmdb', { length: 50 }), // TMDB status: Returning, Ended, etc.
  metadataUpdatedAt: timestamp('metadata_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const series = pgTable('series', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  totalSeasons: integer('total_seasons').default(1),
  totalEpisodes: integer('total_episodes').default(0),
  status: varchar('status', { length: 20 }).default('ongoing'), // ongoing, completed, cancelled
});

export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  seriesId: integer('series_id').references(() => series.id, { onDelete: 'cascade' }).notNull(),
  seasonNumber: integer('season_number').notNull(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  posterUrl: text('poster_url'),
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const episodes = pgTable('episodes', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').references(() => seasons.id, { onDelete: 'cascade' }).notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  duration: integer('duration'), // in seconds
  thumbnailUrl: text('thumbnail_url'),
  stillUrl: text('still_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== Genres ====================

export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
});

export const movieGenres = pgTable('movie_genres', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  genreId: integer('genre_id').references(() => genres.id, { onDelete: 'cascade' }).notNull(),
});

// ==================== Storage Accounts ====================

export const storageAccounts = pgTable('storage_accounts', {
  id: varchar('id', { length: 50 }).primaryKey(), // e.g., 'r2-default', 'tb_01', 'gdrive_01'
  providerType: storageProviderEnum('provider_type').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  status: storageHealthEnum('status').default('connected').notNull(),
  purpose: storagePurposeEnum('purpose').default('general').notNull(),
  priority: integer('priority').default(5).notNull(), // 1-10, higher = preferred
  isDefault: boolean('is_default').default(false).notNull(),
  // Credentials (encrypted in production)
  credentials: jsonb('credentials'), // Encrypted storage credentials
  // Quota tracking
  quotaTotal: integer('quota_total'), // in bytes
  quotaUsed: integer('quota_used').default(0), // in bytes
  // Health tracking
  lastHealthCheck: timestamp('last_health_check'),
  lastHealthStatus: storageHealthEnum('last_health_status'),
  healthMessage: text('health_message'),
  latencyMs: integer('latency_ms'),
  // Metadata
  capabilities: jsonb('capabilities').$type<Record<string, boolean>>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== Media Files ====================

export const mediaFiles = pgTable('media_files', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  // Storage reference
  storageAccountId: varchar('storage_account_id', { length: 50 }).references(() => storageAccounts.id),
  externalFileId: text('external_file_id'), // Provider-specific file ID
  objectPath: text('object_path'), // Path in the storage bucket
  publicUrl: text('public_url'), // Public/custom domain URL if available
  // File metadata
  originalFilename: varchar('original_filename', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  duration: integer('duration'), // in seconds
  width: integer('width'),
  height: integer('height'),
  codec: varchar('codec', { length: 50 }),
  bitrate: integer('bitrate'), // in kbps
  quality: qualityEnum('quality'),
  checksum: text('checksum'), // MD5 or SHA-256 of the file
  // Status
  status: varchar('status', { length: 20 }).default('pending'), // pending, uploading, uploaded, processing, ready, error
  streamingEnabled: boolean('streaming_enabled').default(true),
  downloadEnabled: boolean('download_enabled').default(false),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== Watch History & Progress ====================

export const watchHistory = pgTable('watch_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  watchedAt: timestamp('watched_at').defaultNow().notNull(),
  duration: integer('duration'), // how long they watched in seconds
});

export const watchProgress = pgTable('watch_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
  episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  position: integer('position').default(0), // current position in seconds
  duration: integer('duration'), // total duration in seconds
  completed: boolean('completed').default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== Watchlists ====================

export const watchlists = pgTable('watchlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// ==================== Ratings & Reviews ====================

export const ratings = pgTable('ratings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull(), // 1-10
  review: text('review'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== Audit Logs ====================

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
