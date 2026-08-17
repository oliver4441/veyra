# Veyra

A premium cinematic streaming platform built with Next.js, Cloudflare Workers, and Neon PostgreSQL.

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Next.js App   │────▶│  Cloudflare Worker  │────▶│ Neon PostgreSQL  │
│    (Vercel)     │     │  (Hono Framework)   │     │    (Database)    │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
```

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, PWA
- **Backend:** Cloudflare Workers, Hono Framework
- **Database:** Neon PostgreSQL, Drizzle ORM
- **Storage:** Cloudflare R2 (video, images, assets)
- **Metadata/Discovery:** The Movie Database (TMDB) API v3
- **Auth:** Firebase Authentication (email/password, Google) with server-side ID token verification
- **Deployment:** Vercel (frontend), Cloudflare (backend + storage)

## Project Structure

```
veyra/
├── apps/
│   ├── web/          # Next.js frontend (PWA)
│   └── api/          # Cloudflare Worker backend
│       └── src/
│           ├── lib/
│           │   ├── tmdb.ts          # TMDB API service client
│           │   └── ...              # Auth, DB, R2, storage
│           ├── routes/
│           │   ├── discovery.ts     # Public TMDB discovery endpoints
│           │   ├── admin.ts         # Admin TMDB import/refresh
│           │   └── ...              # Auth, movies, search, etc.
│           └── db/schema.ts         # Drizzle schema (includes TMDB fields)
├── packages/
│   ├── db/           # Shared database schema
│   └── shared/       # Shared types and utilities
├── templates/        # HTML design templates
└── plan.md           # Full project specification
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Wrangler CLI (`npm install -g wrangler`)
- Neon CLI (`npm install -g neonctl`)

### 1. Clone and Install

```bash
git clone https://github.com/oliver4441/veyra.git
cd veyra
npm install
```

### 2. Set Up Neon Database

```bash
# Install neonctl if not installed
npm install -g neonctl

# Authenticate with Neon
neonctl auth

# Create a new project
neonctl projects create --name veyra

# Get the connection string
neonctl connection-string
```

### 3. Configure Environment Variables

```bash
# Copy the example file
cp apps/api/.dev.vars.example apps/api/.dev.vars

# Edit .dev.vars with your Neon connection string, Firebase project id,
# and admin emails
```

### 4. Initialize Database

```bash
# Generate and push schema to Neon
cd apps/api
npx drizzle-kit push
```

### 5. Start Development

```bash
# From the root directory
npm run dev:api   # Starts Cloudflare Worker on port 8787
npm run dev:web   # Starts Next.js on port 3000
```

## API Routes

### Auth (Firebase)
- `POST /api/auth/firebase` - Exchange a Firebase ID token for the Veyra user (auto-creates/links the account)
- `GET /api/auth/me` - Get current user (bearer = Firebase ID token)
- `PATCH /api/auth/profile` - Update display name / avatar

Sign-in itself happens entirely in the browser via the Firebase SDK (email/password, Google). The resulting ID token is sent as a `Bearer` token on every API request and verified server-side against Google's JWKS.

### Movies
- `GET /api/movies` - List movies (pagination, filtering)
- `GET /api/movies/featured` - Featured movies
- `GET /api/movies/trending` - Trending movies
- `GET /api/movies/:slug` - Get movie by slug

### Search
- `GET /api/search?q=query` - Search movies
- `GET /api/search/suggestions?q=query` - Autocomplete

### Watch (Protected)
- `GET /api/watch/progress` - Get watch progress
- `POST /api/watch/progress` - Update progress
- `GET /api/watch/history` - Watch history
- `GET /api/watch/streaming-url/:movieId` - Get streaming URL
- `GET /api/watch/watchlist` - Get watchlist
- `POST /api/watch/watchlist` - Add to watchlist
- `DELETE /api/watch/watchlist/:movieId` - Remove from watchlist

### Discovery (Public)
- `GET /api/discovery/search?q=query` - Search TMDB
- `GET /api/discovery/suggestions?q=query` - Autocomplete from TMDB
- `GET /api/discovery/trending` - Trending (day/week)
- `GET /api/discovery/popular?media_type=movie` - Popular movies/TV
- `GET /api/discovery/movie/:tmdbId` - TMDB movie details
- `GET /api/discovery/tv/:tmdbId` - TMDB TV details
- `GET /api/discovery/movie/:tmdbId/recommendations` - Recommendations
- `GET /api/discovery/tv/:tmdbId/recommendations` - TV recommendations
- `GET /api/discovery/genres` - Merged genre list

### Admin (Protected, Admin Only)
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/movies` - List all movies
- `POST /api/admin/movies` - Create movie
- `PUT /api/admin/movies/:id` - Update movie
- `DELETE /api/admin/movies/:id` - Delete movie
- `POST /api/admin/movies/:id/episodes` - Add episode
- `GET /api/admin/audit` - Audit logs
- `GET /api/admin/users` - List users
- `POST /api/admin/tmdb/search` - Search TMDB for import
- `POST /api/admin/tmdb/import` - Import TMDB metadata into Veyra
- `POST /api/admin/tmdb/refresh/:movieId` - Refresh metadata from TMDB
- `GET /api/admin/tmdb/check/:tmdbId` - Check if already imported

### Storage (Protected, Admin Only)
- `POST /api/storage/upload/movie` - Upload movie file to R2
- `POST /api/storage/upload/episode` - Upload episode file to R2
- `POST /api/storage/upload/image` - Upload poster/backdrop/thumbnail
- `GET /api/storage/download/:key` - Get download URL
- `DELETE /api/storage/:key` - Delete file from R2
- `GET /api/storage/list` - List files in R2
- `GET /api/storage/quota` - Get storage usage

## Deployment

### Frontend (Vercel)

```bash
cd apps/web
vercel deploy
```

### Backend (Cloudflare Workers)

```bash
cd apps/api

# Set secrets (vars are configured in wrangler.jsonc)
wrangler secret put DATABASE_URL
wrangler secret put CORS_ORIGIN
wrangler secret put TMDB_API_READ_ACCESS_TOKEN

# Set the Firebase project id (matches your Firebase web app config)
# and admin emails in the "vars" block of wrangler.jsonc:
#   FIREBASE_PROJECT_ID=omix-systems-cd1af
#   ADMIN_EMAILS=you@gmail.com

# Deploy
wrangler deploy
```

## TMDB Integration

### Overview

Veyra integrates with The Movie Database (TMDB) for metadata and discovery. TMDB is **not** a streaming source — it provides movie/TV metadata, posters, backdrops, cast info, and discovery data. All actual video content remains in Veyra's own storage (Cloudflare R2).

### Architecture

```
TMDB API (v3)
  ↓
Cloudflare Worker (server-side only)
  ↓
Admin imports movie metadata
  ↓
Neon PostgreSQL (source of truth)
  ↓
Veyra API serves catalog to frontend
  ↓
Next.js PWA
```

### Required Environment Variable

| Variable | Where | Description |
|---|---|---|
| `TMDB_API_READ_ACCESS_TOKEN` | Cloudflare Workers only | TMDB API v3 Read Access Token |

### Setup

1. **Get a TMDB API key** at [themoviedb.org](https://www.themoviedb.org/settings/api)
   - Create an account → Settings → API → Request an API key
   - Choose "Developer" → fill in app info
   - Copy the **API Read Access Token** (Bearer token)

2. **For local development** — add to `apps/api/.dev.vars`:
   ```
   TMDB_API_READ_ACCESS_TOKEN=your_token_here
   ```

3. **For production** — set as a Cloudflare Workers secret:
   ```bash
   wrangler secret put TMDB_API_READ_ACCESS_TOKEN
   # Paste your token when prompted
   ```

### Security

- The TMDB token is **server-side only** — never exposed to the browser
- The frontend communicates with Veyra's API, not directly with TMDB
- Admin import routes require admin authentication
- TMDB IDs are validated on import
- Duplicate imports are prevented by TMDB ID + media type uniqueness

### Admin Import Workflow

1. Admin navigates to **Admin → Movie Management → TMDB Import**
2. Searches for a movie or TV show by title
3. Previews TMDB results (title, poster, overview, rating, year)
4. Clicks "Import to Veyra"
5. System fetches full TMDB details (genres, cast, countries, etc.)
6. Creates a Veyra catalog entry linked to the TMDB ID
7. Admin can later refresh metadata from TMDB or attach streaming files

### Discovery Sections (Frontend)

The homepage shows TMDB-powered sections:
- **Trending Today** — TMDB trending across all media
- **Popular Movies** — TMDB popular movies
- **Popular TV Shows** — TMDB popular TV

These sections degrade gracefully if TMDB is unavailable.

### Database Schema Changes

The `movies` table includes these TMDB-specific fields:
- `tmdb_id` — TMDB external ID
- `tmdb_media_type` — "movie" or "tv"
- `original_title` — Original language title
- `original_language` — ISO 639-1 code
- `overview` — Full TMDB plot synopsis
- `release_date` — Release/air date string
- `vote_average` — TMDB user rating
- `vote_count` — Number of TMDB votes
- `popularity` — TMDB popularity score
- `poster_path` — TMDB poster path
- `backdrop_path` — TMDB backdrop path
- `genres` — JSON array of genre names
- `production_countries` — JSON array
- `spoken_languages` — JSON array
- `status_tmdb` — TMDB status (Returning, Ended, Released, etc.)
- `metadata_updated_at` — Last sync timestamp

To apply schema changes to Neon:
```bash
cd apps/api
npx drizzle-kit push
```

## Design System

Veyra uses a **Cinematic Glassmorphism** design system with:

- **Primary:** Veyra Violet (#d0bcff)
- **Background:** Near-Black (#0A0A0B)
- **Surface:** Elevated Dark (#141416)
- **Typography:** Plus Jakarta Sans
- **Effects:** Glass panels, violet glow, smooth animations

See `templates/DESIGN.md` for the complete design specification.

## License

Private - All rights reserved.
