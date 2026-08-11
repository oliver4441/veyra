-- Veyra Database Schema
-- Run this SQL to create all tables in Neon

-- ==================== Enums ====================

CREATE TYPE user_role AS ENUM ('user', 'admin', 'superadmin');
CREATE TYPE media_type AS ENUM ('movie', 'series');
CREATE TYPE rights_status AS ENUM ('owned', 'licensed', 'public_domain', 'creator_authorized', 'pending_review', 'blocked');
CREATE TYPE media_status AS ENUM ('draft', 'processing', 'published', 'archived');
CREATE TYPE storage_provider AS ENUM ('cloudflare-r2', 'terabox', 'google-drive', 'backblaze-b2', 'dropbox', 'mega', 's3-compatible');
CREATE TYPE storage_purpose AS ENUM ('primary-media', 'archive', 'posters-artwork', 'subtitles', 'trailers', 'backups', 'hot-storage', 'cold-storage', 'general');
CREATE TYPE storage_health AS ENUM ('connected', 'disconnected', 'auth-expired', 'error', 'rate-limited', 'storage-full', 'unavailable');
CREATE TYPE quality AS ENUM ('480', '720', '1080', '4k');

-- ==================== Users & Auth ====================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Movies & Series ====================

CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(300),
    type media_type DEFAULT 'movie' NOT NULL,
    year INTEGER,
    duration INTEGER, -- in seconds
    rating VARCHAR(10), -- PG-13, R, etc.
    imdb_rating REAL,
    director VARCHAR(255),
    "cast" JSONB, -- array of actor names
    tags JSONB,
    poster_url TEXT,
    backdrop_url TEXT,
    trailer_url TEXT,
    status media_status DEFAULT 'draft' NOT NULL,
    rights_status rights_status DEFAULT 'pending_review' NOT NULL,
    streaming_enabled BOOLEAN DEFAULT false NOT NULL,
    download_enabled BOOLEAN DEFAULT false NOT NULL,
    available_qualities JSONB DEFAULT '["480", "720", "1080"]',
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE series (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
    total_seasons INTEGER DEFAULT 1,
    total_episodes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ongoing' -- ongoing, completed, cancelled
);

CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    series_id INTEGER REFERENCES series(id) ON DELETE CASCADE NOT NULL,
    season_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT,
    poster_url TEXT,
    year INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE episodes (
    id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
    episode_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER, -- in seconds
    thumbnail_url TEXT,
    still_url TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Genres ====================

CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE movie_genres (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE NOT NULL
);

-- ==================== Storage Accounts ====================

CREATE TABLE storage_accounts (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'r2-default', 'tb_01', 'gdrive_01'
    provider_type storage_provider NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    status storage_health DEFAULT 'connected' NOT NULL,
    purpose storage_purpose DEFAULT 'general' NOT NULL,
    priority INTEGER DEFAULT 5 NOT NULL, -- 1-10, higher = preferred
    is_default BOOLEAN DEFAULT false NOT NULL,
    credentials JSONB, -- Encrypted storage credentials
    quota_total INTEGER, -- in bytes
    quota_used INTEGER DEFAULT 0, -- in bytes
    last_health_check TIMESTAMP,
    last_health_status storage_health,
    health_message TEXT,
    latency_ms INTEGER,
    capabilities JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Media Files ====================

CREATE TABLE media_files (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    storage_account_id VARCHAR(50) REFERENCES storage_accounts(id),
    external_file_id TEXT, -- Provider-specific file ID
    object_path TEXT, -- Path in the storage bucket
    public_url TEXT, -- Public/custom domain URL if available
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    file_size INTEGER,
    duration INTEGER, -- in seconds
    width INTEGER,
    height INTEGER,
    codec VARCHAR(50),
    bitrate INTEGER, -- in kbps
    quality quality,
    checksum TEXT, -- MD5 or SHA-256 of the file
    status VARCHAR(20) DEFAULT 'pending', -- pending, uploading, uploaded, processing, ready, error
    streaming_enabled BOOLEAN DEFAULT true,
    download_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Watch History & Progress ====================

CREATE TABLE watch_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    watched_at TIMESTAMP DEFAULT NOW() NOT NULL,
    duration INTEGER -- how long they watched in seconds
);

CREATE TABLE watch_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0, -- current position in seconds
    duration INTEGER, -- total duration in seconds
    completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Watchlists ====================

CREATE TABLE watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Ratings & Reviews ====================

CREATE TABLE ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL, -- 1-10
    review TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Audit Logs ====================

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ==================== Indexes ====================

CREATE INDEX idx_movies_slug ON movies(slug);
CREATE INDEX idx_movies_status ON movies(status);
CREATE INDEX idx_movies_type ON movies(type);
CREATE INDEX idx_movies_featured ON movies(featured);
CREATE INDEX idx_movies_trending ON movies(trending);
CREATE INDEX idx_movies_year ON movies(year);

CREATE INDEX idx_episodes_season_id ON episodes(season_id);
CREATE INDEX idx_seasons_series_id ON seasons(series_id);

CREATE INDEX idx_movie_genres_movie_id ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre_id ON movie_genres(genre_id);

CREATE INDEX idx_media_files_movie_id ON media_files(movie_id);
CREATE INDEX idx_media_files_episode_id ON media_files(episode_id);
CREATE INDEX idx_media_files_storage_account_id ON media_files(storage_account_id);

CREATE INDEX idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX idx_watch_history_movie_id ON watch_history(movie_id);
CREATE INDEX idx_watch_progress_user_id ON watch_progress(user_id);
CREATE INDEX idx_watch_progress_movie_id ON watch_progress(movie_id);

CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_movie_id ON watchlists(movie_id);

CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_ratings_movie_id ON ratings(movie_id);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ==================== Insert Default Data ====================

-- Insert default genres
INSERT INTO genres (name, slug) VALUES
    ('Action', 'action'),
    ('Adventure', 'adventure'),
    ('Animation', 'animation'),
    ('Comedy', 'comedy'),
    ('Crime', 'crime'),
    ('Documentary', 'documentary'),
    ('Drama', 'drama'),
    ('Fantasy', 'fantasy'),
    ('Horror', 'horror'),
    ('Mystery', 'mystery'),
    ('Romance', 'romance'),
    ('Sci-Fi', 'sci-fi'),
    ('Thriller', 'thriller'),
    ('War', 'war'),
    ('Western', 'western');

-- Insert default R2 storage account
INSERT INTO storage_accounts (id, provider_type, display_name, status, purpose, priority, is_default, capabilities) VALUES
    ('r2-default', 'cloudflare-r2', 'Cloudflare R2', 'connected', 'primary-media', 10, true, '{"upload": true, "download": true, "streaming": true, "directLinks": true, "thumbnails": true, "delete": true, "folders": true, "multipartUpload": true}');
