# Veyra

> A cinematic, self-hostable streaming platform built for a fast web experience, modern infrastructure, and contributor-friendly development.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/API-Cloudflare%20Workers-f38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Neon](https://img.shields.io/badge/Database-Neon-00e699?logo=postgresql)](https://neon.tech/)
[![Drizzle](https://img.shields.io/badge/ORM-Drizzle-C5F74F)](https://orm.drizzle.team/)

Veyra separates the user experience, API, database, and object storage into clear layers so the project can scale without coupling the frontend to infrastructure details.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Development](#development)
- [API](#api)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [Community](#community)
- [Funding](#funding)
- [License](#license)

## Features

Veyra is designed around a cinematic streaming workflow with:

- Responsive Next.js PWA frontend
- Movie discovery, featured and trending content
- Search and autocomplete
- Authentication and session management
- Watch progress and history
- Watchlist management
- Protected streaming URL generation
- Admin movie and episode management
- Audit logs and user administration
- Cloudflare R2 media storage
- Neon PostgreSQL database with Drizzle ORM
- Cloudflare Workers API powered by Hono
- Separate frontend/backend deployment targets

The exact capabilities available in a deployment depend on the current implementation and configured infrastructure.

## Architecture

```text
                         Veyra
                           │
             ┌─────────────┴─────────────┐
             │                           │
        Next.js PWA                Cloudflare Worker
          (Vercel)                      (Hono)
             │                           │
             │                    ┌──────┴──────┐
             │                    │             │
             │                 Neon DB       Cloudflare R2
             │                PostgreSQL     Media storage
             │
             └────────────── API requests ──────────────┘
```

### Responsibilities

- **Web:** UI, routing, PWA experience, client-side interaction.
- **API:** authentication, authorization, business logic, database access, storage operations.
- **Database:** users, movies, watch state, watchlists, administration data, and related records.
- **R2:** video, images, thumbnails, and other object assets.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, Tailwind CSS, PWA |
| Backend | Cloudflare Workers, Hono |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM |
| Storage | Cloudflare R2 |
| Authentication | JWT + PBKDF2 password hashing |
| Frontend hosting | Vercel |
| API/storage hosting | Cloudflare |

## Repository structure

```text
veyra/
├── apps/
│   ├── web/             # Next.js frontend / PWA
│   └── api/             # Cloudflare Worker API
├── packages/
│   ├── db/              # Shared database schema
│   └── shared/          # Shared types and utilities
├── templates/           # Design and HTML templates
├── .github/             # Funding, issue templates, security/community docs
├── CONTRIBUTING.md      # Contributor workflow
├── SECURITY.md          # Security reporting policy
└── plan.md              # Project specification / roadmap material
```

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+
- A Neon PostgreSQL database
- Wrangler CLI for API development/deployment
- Vercel CLI if deploying the frontend from the CLI

Optional tooling can be installed globally when needed:

```bash
npm install -g wrangler
```

### 1. Clone the repository

```bash
git clone https://github.com/oliver4441/veyra.git
cd veyra
npm install
```

### 2. Configure local environment

Use the example environment files supplied by the repository. Do not commit `.env`, `.dev.vars`, credentials, API keys, JWT secrets, or database passwords.

For the API:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Then populate the local values required by the current API configuration.

### 3. Configure the database

Veyra uses Neon PostgreSQL with Drizzle ORM.

If you use the Neon CLI:

```bash
npm install -g neonctl
neonctl auth
```

Create or select a Neon project and provide its connection string through the local API environment configuration.

### 4. Initialize the schema

From the API workspace, use the repository's configured Drizzle commands. For a development database, the existing setup can be used with:

```bash
cd apps/api
npx drizzle-kit push
```

Only run schema changes against a database you intend to modify.

### 5. Start development

From the repository root, use the scripts exposed by the current `package.json`:

```bash
npm run dev:api
npm run dev:web
```

The API runs on port `8787` and the web application normally runs on port `3000` when using the documented scripts.

## Environment variables

Secrets belong in local environment files or deployment secret stores, never in source control.

The production API currently expects infrastructure configuration such as:

```text
DATABASE_URL
JWT_SECRET
CORS_ORIGIN
```

Storage configuration may also be required by the current Worker/R2 implementation.

For Cloudflare deployments, use Wrangler secrets rather than hard-coding credentials:

```bash
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put CORS_ORIGIN
```

Never paste real secrets into Issues, Discussions, pull requests, logs, screenshots, or documentation.

## API

The API is organized around authentication, discovery, search, watch state, administration, and storage.

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

### Movies

```text
GET /api/movies
GET /api/movies/featured
GET /api/movies/trending
GET /api/movies/:slug
```

### Search

```text
GET /api/search?q=query
GET /api/search/suggestions?q=query
```

### Watch — protected

```text
GET    /api/watch/progress
POST   /api/watch/progress
GET    /api/watch/history
GET    /api/watch/streaming-url/:movieId
GET    /api/watch/watchlist
POST   /api/watch/watchlist
DELETE /api/watch/watchlist/:movieId
```

### Admin — protected/admin only

```text
GET    /api/admin/dashboard
GET    /api/admin/movies
POST   /api/admin/movies
PUT    /api/admin/movies/:id
DELETE /api/admin/movies/:id
POST   /api/admin/movies/:id/episodes
GET    /api/admin/audit
GET    /api/admin/users
```

### Storage — protected/admin only

```text
POST   /api/storage/upload/movie
POST   /api/storage/upload/episode
POST   /api/storage/upload/image
GET    /api/storage/download/:key
DELETE /api/storage/:key
GET    /api/storage/list
GET    /api/storage/quota
```

Authentication and authorization must be enforced by the API. Never rely on the frontend alone to protect admin or storage operations.

## Deployment

### Frontend — Vercel

The Next.js application can be deployed from `apps/web` using Vercel or the repository's configured deployment integration.

```bash
cd apps/web
vercel deploy
```

### API — Cloudflare Workers

Set production secrets through Wrangler:

```bash
cd apps/api
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put CORS_ORIGIN
wrangler deploy
```

Configure R2 bindings and any additional Worker variables according to the current `wrangler` configuration.

## Design system

Veyra uses a cinematic dark interface with a glass-inspired visual language.

- **Primary:** Veyra Violet `#d0bcff`
- **Background:** Near-black `#0A0A0B`
- **Surface:** Elevated dark `#141416`
- **Typography:** Plus Jakarta Sans
- **Visual language:** Glass panels, controlled violet glow, smooth transitions

The detailed design specification is maintained under `templates/`.

When changing the UI, preserve responsive behavior, accessibility, reduced-motion preferences, and performance.

## Security

Security issues should **not** be reported through public Issues or Discussions.

See [`SECURITY.md`](./SECURITY.md) for the reporting process.

In particular, never commit:

- API keys
- Database credentials
- JWT secrets
- Cloudflare credentials
- R2 credentials
- `.env` or `.dev.vars` files containing secrets
- Personal access tokens

If a secret is accidentally committed, rotate/revoke it immediately. Removing it from the latest commit does not remove it from Git history.

## Contributing

Contributions are welcome.

Before starting work:

1. Check existing Issues and Discussions.
2. For bugs, use the bug report template.
3. For feature proposals, use the feature request template or start a Discussion if the idea needs community feedback.
4. Keep changes focused.
5. Run the available build/tests before opening a PR.
6. Never commit secrets.

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contributor workflow.

### Pull request expectations

A good PR should explain:

- What changed
- Why it changed
- How it was tested
- Any UI screenshots for meaningful frontend changes
- Any database migrations
- Any new environment variables

Avoid unrelated refactors in feature PRs.

## Community

GitHub Discussions are intended for community conversation, questions, ideas, development discussions, and project updates.

Recommended categories:

- Announcements
- General
- Ideas
- Q&A
- Development
- Show and Tell

Use Issues for actionable bugs and implementation-ready feature requests.

## Funding

Veyra is supported through GitHub Sponsors.

If Veyra is useful to you, consider supporting continued development, infrastructure, security work, and new features:

**[Sponsor Veyra](https://github.com/sponsors/oliver4441)**

## Project status

Veyra is under active development. APIs, infrastructure, database schema, and UI behavior may change as the project evolves.

Before deploying to production, review the current source, environment configuration, database migrations, authentication implementation, storage authorization, and deployment configuration.

## License

The current repository is marked **Private / All Rights Reserved** in the project documentation. Do not assume that the code is open-source merely because the repository becomes publicly visible.

If the project is later released under an open-source license, replace this section with the exact license and copyright terms.
