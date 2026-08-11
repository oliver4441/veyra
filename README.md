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
- **Auth:** Custom JWT with PBKDF2 password hashing
- **Deployment:** Vercel (frontend), Cloudflare (backend + storage)

## Project Structure

```
veyra/
├── apps/
│   ├── web/          # Next.js frontend (PWA)
│   └── api/          # Cloudflare Worker backend
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

# Edit .dev.vars with your Neon connection string and JWT secret
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

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user

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

### Admin (Protected, Admin Only)
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/movies` - List all movies
- `POST /api/admin/movies` - Create movie
- `PUT /api/admin/movies/:id` - Update movie
- `DELETE /api/admin/movies/:id` - Delete movie
- `POST /api/admin/movies/:id/episodes` - Add episode
- `GET /api/admin/audit` - Audit logs
- `GET /api/admin/users` - List users

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

# Set secrets
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put CORS_ORIGIN

# Deploy
wrangler deploy
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
