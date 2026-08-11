# Build Specification: Community Media Streaming Platform

Build a production-oriented Netflix-style media platform for legally owned, licensed, creator-owned, or public-domain video content.

The platform must NOT be designed to facilitate copyright infringement, piracy, unauthorized redistribution, DRM circumvention, or bypassing TeraBox restrictions. Only content that the platform operator has the legal right to store, stream, and distribute may be uploaded.

## 1. Product Concept

Create a Netflix-style web application where:

* Only administrators/operators upload media.
* Normal users cannot upload media.
* Normal users cannot connect arbitrary storage providers.
* Users can browse the catalog.
* Users can stream authorized content.
* Downloads can be enabled or disabled per title.
* Users have accounts and personalized libraries.
* The system tracks watch progress.
* The system supports movies and series.
* The platform has an admin dashboard for media management.
* TeraBox is the primary bulk media storage/origin candidate.
* Cloudflare is the API/backend/edge layer.
* Vercel hosts the frontend.
* Supabase PostgreSQL is the application database.
* Cloudflare R2 is optional for thumbnails, posters, subtitles, caching, and selected hot-content assets.

The application should be designed so TeraBox can be replaced by another storage provider without rewriting the application.

---

# 2. Architecture

Use this architecture:

```text
                         USERS
                           |
                           v
                 +-------------------+
                 |      Vercel       |
                 | Next.js Frontend  |
                 +---------+---------+
                           |
                           v
                 +-------------------+
                 |    Cloudflare     |
                 |      Workers      |
                 | API / Edge Layer  |
                 +---------+---------+
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        Supabase       TeraBox API    Cloudflare R2
        PostgreSQL         |              |
             |             |              |
             |             |              |
             v             v              v
       Application      Video origin    Assets/cache
        metadata       / M3U8/dlinks
```

Responsibilities:

### Vercel

Use for:

* Next.js application
* Server-rendered pages where appropriate
* Netflix-style UI
* Movie catalog
* Search UI
* Watch page
* Player UI
* User dashboard
* Admin dashboard

Do not put TeraBox secrets in frontend code.

### Cloudflare Workers

Use for:

* REST/API endpoints
* Authentication/session validation
* Authorization
* Movie lookup
* Watch-history updates
* TeraBox API integration
* Download authorization
* Streaming URL generation
* Rate limiting
* Request validation
* Security controls
* Optional caching
* Storage abstraction

### Supabase PostgreSQL

Use only for application data.

Do NOT use Supabase as the primary movie-file storage system.

Store:

* Users
* Roles
* Movies
* Series
* Episodes
* Genres
* Categories
* TeraBox file IDs
* TeraBox paths
* Storage-provider information
* Posters
* Thumbnails
* Watch history
* Watch progress
* Watchlists
* Permissions
* Download permissions
* Audit logs
* Processing status
* Media metadata

### TeraBox

Use as the primary bulk media storage/origin candidate.

The official TeraBox Open Platform documentation currently exposes:

* OAuth authorization
* Access/refresh tokens
* File upload APIs
* File creation
* File metadata
* Quota APIs
* Download links
* Online video streaming
* M3U8 playback at 480p/720p/1080p

Reference the official documentation during implementation:

https://www.terabox.com/integrations/docs?lang=en

Do not scrape the TeraBox website when the official API provides the required functionality.

### Cloudflare R2

Use selectively for:

* Posters
* Backdrops
* Thumbnails
* Subtitles
* Small media assets
* Optional cache of hot content
* Optional future transcoded content

Do not automatically duplicate every TeraBox movie into R2.

---

# 3. Storage abstraction

Do NOT hard-code TeraBox throughout the application.

Create:

```text
StorageProvider
```

with an interface similar to:

```typescript
interface StorageProvider {
  upload(...)
  delete(...)
  getMetadata(...)
  list(...)
  getQuota(...)
  getDownloadUrl(...)
  getStreamingUrl(...)
}
```

Implement:

```text
TeraBoxProvider
R2Provider
```

Design the system so future providers can be added:

```text
B2Provider
S3Provider
GoogleDriveProvider
DropboxProvider
```

without changing the movie/player/business logic.

The database should store:

```text
storage_provider
storage_file_id
storage_path
storage_metadata
```

rather than assuming every movie belongs to TeraBox.

---

# 4. TeraBox authentication

Use the official OAuth/Open Platform flow.

Never expose:

```text
client_secret
private_secret
access_token
refresh_token
```

to the browser.

Store secrets only in Cloudflare Worker environment variables/secrets.

Implement:

```text
OAuth authorization
        |
        v
authorization code
        |
        v
access token
        |
        v
refresh token
```

Handle token expiration automatically.

The TeraBox documentation states that access tokens can expire and refresh tokens can be used to obtain new access tokens.

Cache the TeraBox API domain according to the official documentation rather than assuming a permanent API hostname for every user/account.

---

# 5. Admin upload pipeline

Only administrators can upload media.

Flow:

```text
Admin
 |
 | upload
 v
Cloudflare API
 |
 v
Media processing job
 |
 +--> FFprobe metadata
 |
 +--> Validate file
 |
 +--> Generate thumbnail
 |
 +--> Extract duration
 |
 +--> Extract resolution
 |
 +--> Extract codec information
 |
 v
TeraBox upload
 |
 v
Store TeraBox fs_id/path
 |
 v
Create/update database record
```

Support large files using TeraBox's documented upload/precreate/sharded-upload/create workflow.

Do not send large media through Vercel serverless functions unnecessarily.

Where possible, perform long-running processing in a dedicated worker/compute service rather than tying it to a short-lived frontend request.

---

# 6. Movie database

Create a relational PostgreSQL schema.

Minimum tables:

```text
users
profiles
roles

movies
series
seasons
episodes

genres
movie_genres

media_files
media_processing_jobs

watch_history
watch_progress
watchlists

ratings
comments

downloads
stream_sessions

storage_providers

audit_logs
```

Example `media_files`:

```text
id
movie_id
storage_provider
storage_file_id
storage_path
original_filename
mime_type
file_size
duration
width
height
codec
status
streaming_enabled
download_enabled
created_at
updated_at
```

---

# 7. Streaming architecture

TeraBox's official Open Platform documents:

```text
/openapi/api/streaming
```

with:

```text
M3U8_AUTO_480
M3U8_AUTO_720
M3U8_AUTO_1080
```

Use the official API rather than scraping TeraBox streaming pages.

Streaming flow:

```text
Browser
   |
   v
Cloudflare Worker
   |
   +--> authenticate user
   |
   +--> verify movie exists
   |
   +--> verify streaming_enabled
   |
   +--> verify user authorization
   |
   v
TeraBox API
   |
   v
M3U8
   |
   v
HTML5/HLS player
```

Never expose the TeraBox access token.

The application should request the streaming URL server-side.

---

# 8. Video player

Use a proper HLS-compatible player.

Implement:

```text
Play
Pause
Seek
Volume
Fullscreen
Playback speed
Quality selection
Auto quality
Subtitles
Picture-in-picture where supported
Resume playback
```

Quality:

```text
Auto
1080p
720p
480p
```

Do not assume every file supports every quality.

If a quality request fails, gracefully fall back.

---

# 9. Download architecture

Downloads must be independently permission-controlled.

Database:

```text
streaming_enabled
download_enabled
```

Download flow:

```text
User clicks Download
        |
        v
Cloudflare Worker
        |
        +--> authenticate
        |
        +--> authorize
        |
        +--> verify download_enabled
        |
        v
TeraBox API
        |
        v
temporary download URL
        |
        v
User
```

Do not permanently store temporary TeraBox download links.

Generate them when needed.

The official TeraBox documentation shows download links with expiration parameters, so treat them as temporary credentials.

Do not proxy an entire multi-GB movie through Cloudflare Workers.

Prefer redirecting the authorized client to the provider's temporary URL where technically and contractually appropriate.

---

# 10. Watch progress

When a user watches:

```text
Movie ID
User ID
Current position
Duration
Timestamp
```

periodically save progress.

Example:

```text
movie_id = 123
position = 1823
duration = 7200
completed = false
```

Show:

```text
Continue Watching
```

on the homepage.

Resume playback automatically.

---

# 11. Netflix-style UI

Build a modern dark media interface.

Pages:

```text
/
 /browse
 /search
 /movie/[id]
 /series/[id]
 /watch/[id]
 /watchlist
 /history
 /profile
 /settings

 /admin
 /admin/movies
 /admin/movies/new
 /admin/movies/[id]
 /admin/storage
 /admin/jobs
 /admin/users
 /admin/audit
```

Homepage sections:

```text
Continue Watching

Trending

Recently Added

Featured

Action

Comedy

Drama

Animation

Documentaries

Series

New Releases
```

Use responsive design for:

* Android
* iPhone
* tablet
* desktop
* TV-sized screens

---

# 12. Search

Implement PostgreSQL full-text search initially.

Search:

```text
Title
Description
Genre
Cast
Director
Year
Tags
```

Do not introduce Elasticsearch/OpenSearch unless PostgreSQL becomes insufficient.

---

# 13. Admin dashboard

Admin should be able to:

```text
Upload movie
Edit metadata
Delete movie
Move movie
Sync TeraBox
Check storage quota
View processing jobs
Enable/disable streaming
Enable/disable downloads
Change quality availability
Manage posters
Manage subtitles
Manage categories
Manage users
View audit logs
```

Storage dashboard:

```text
TeraBox
-------------------
Used
Available
Total
Usage percentage

R2
-------------------
Used
Available

B2
-------------------
Used
Available
```

Warn when TeraBox approaches capacity.

---

# 14. TeraBox synchronization

Build a synchronization service.

It should be able to:

```text
Scan TeraBox
       |
       v
Find files
       |
       +--> Match existing database records
       |
       +--> Detect new files
       |
       +--> Detect deleted files
       |
       +--> Detect changed files
       |
       v
Update PostgreSQL
```

Use TeraBox file IDs and metadata rather than relying exclusively on filenames.

Do not automatically publish every TeraBox file.

Only files explicitly marked as published should appear in the catalog.

---

# 15. Security

Implement:

* Supabase authentication
* Role-based access control
* Admin-only upload
* Admin-only deletion
* Server-side TeraBox credentials
* Rate limiting
* Input validation
* Signed/session-controlled application endpoints
* CSRF protection where applicable
* CORS restrictions
* Security headers
* Audit logging
* Abuse detection
* Download authorization
* Stream authorization
* Request logging without exposing secrets

Never log:

```text access_token
refresh_token
client_secret
private_secret
temporary download URLs
```

---

# 16. Copyright/compliance

The platform must explicitly support only content that the operator has the legal right to distribute.

Create:

```text
Copyright Policy
Terms of Service
Privacy Policy
Content Policy
Takedown/Report process
```

Include an admin field:

```text rights_status
```

Possible values:

```text
owned
licensed
public_domain
creator_authorized
pending_review
blocked
```

Only approved content can be published.

Do not build functionality intended to bypass copyright enforcement, TeraBox restrictions, access controls, DRM, geographic restrictions, API limitations, or account restrictions.

Do not use multiple accounts or proxy mechanisms to evade provider limits.

---

# 17. TeraBox compliance gate

Before production deployment, explicitly verify the current TeraBox Open Platform terms and obtain any required approval for using TeraBox as the origin/storage layer of a public streaming application.

The current public documentation confirms technical APIs for:

* authorization
* uploads
* metadata
* quota
* downloads
* M3U8 video playback

but the implementation must not assume that the standard/free consumer storage allowance automatically grants permission to operate a third-party public streaming service.

Create a configuration flag:

```text
TERABOX_PRODUCTION_APPROVED=false
```

Development can work against the official API.

Production media serving should require this flag to be explicitly enabled after the provider's requirements have been verified.

---

# 18. Cloudflare architecture

Use:

```text
Cloudflare DNS
Cloudflare Workers
Cloudflare R2
Cloudflare WAF
Cloudflare Turnstile where useful
```

Worker routes:

```text
/api/auth/*
/api/movies/*
/api/search/*
/api/watch/*
/api/download/*
/api/stream/*
/api/admin/*
/api/terabox/*
```

Keep the API stateless where possible.

Use Supabase/PostgreSQL as the persistent application state.

---

# 19. Vercel architecture

Use Vercel only for the frontend/application presentation layer where possible.

Do not depend on Vercel serverless functions for:

* large video uploads
* long FFmpeg jobs
* long-running media processing
* proxying multi-GB downloads

Use dedicated workers/services for those operations.

---

# 20. Media processing

Use FFmpeg/FFprobe.

Support:

```text
MP4
MKV
MOV
WebM
AVI
```

Detect:

```text
codec
resolution
fps
bitrate
audio tracks
subtitle tracks
duration
```

Generate:

```text
poster.jpg
thumbnail.jpg
preview image
metadata.json
```

Do not unnecessarily transcode a file if TeraBox already provides suitable streaming playback.

Only transcode when necessary.

---

# 21. Performance strategy

Do NOT immediately duplicate every movie into R2.

Use TeraBox as the bulk origin.

Use R2 selectively for:

```text
Posters
Thumbnails
Subtitles
Metadata assets
Hot-content cache
Future optimized streaming copies
```

Design a future hot-content system:

```text
Low popularity
      |
      v
TeraBox origin

High popularity
      |
      v
Optional R2 copy/cache
      |
      v
Cloudflare edge
```

Do not implement this automatically until the TeraBox API and provider terms have been verified for the intended workload.

---

# 22. Cost-conscious design

Prioritize free/low-cost services:

```text
Vercel
Cloudflare Workers
Cloudflare R2
Supabase
TeraBox
FFmpeg
```

Do not introduce paid infrastructure unnecessarily.

Keep the application modular so storage or compute providers can be swapped later.

---

# 23. Important technical constraint

TeraBox's streaming endpoint returns M3U8 content whose individual media segment URLs are hosted by TeraBox.

Therefore, test:

1. Browser playback.
2. hls.js playback.
3. CORS behavior.
4. Segment accessibility.
5. URL expiration.
6. Quality switching.
7. Concurrent viewers.
8. Mobile playback.
9. Error recovery.
10. Token refresh.
11. Rate limits.
12. API quotas.
13. Behavior after temporary URLs expire.

Do not assume that because the API returns an M3U8 playlist, unlimited public concurrent playback is supported.

Build a provider health/diagnostic page for administrators.

---

# 24. Development phases

## Phase 1

Build:

```text
Next.js
Supabase
Cloudflare Worker
Authentication
Movie catalog
Admin dashboard
```

## Phase 2

Implement:

```text
TeraBox OAuth
Token management
Quota
File listing
File metadata
```

## Phase 3

Implement:

```text
Admin upload
TeraBox upload
Database synchronization
```

## Phase 4

Implement:

```text
TeraBox M3U8 streaming
HLS player
Quality selection
Watch progress
```

## Phase 5

Implement:

```text
Download authorization
Temporary download URLs
Download history
```

## Phase 6

Implement:

```text
R2
Posters
Thumbnails
Subtitles
Caching
```

## Phase 7

Implement:

```text
Search
Recommendations
Watchlists
Ratings
Continue Watching
```

## Phase 8

Load-test:

```text
1 viewer
10 viewers
50 viewers
100 viewers
```

Measure:

```text
API latency
TeraBox latency
M3U8 response time
segment loading time
failure rate
concurrent playback
download performance
```

Do not claim production scalability until these tests have been performed.

---

# 25. Deliverables

Produce:

1. Complete architecture.
2. Database schema.
3. Next.js frontend.
4. Cloudflare Worker API.
5. Supabase integration.
6. TeraBox provider adapter.
7. R2 provider adapter.
8. OAuth/token management.
9. Admin dashboard.
10. Movie catalog.
11. HLS player.
12. Download system.
13. Watch history.
14. Storage synchronization.
15. Security controls.
16. Environment-variable template.
17. Database migrations.
18. API documentation.
19. Deployment instructions.
20. Testing suite.

Use TypeScript throughout.

Prioritize clean abstractions, security, observability, provider independence, and low infrastructure cost.

Do not use unofficial TeraBox scraping libraries when the official Open Platform API provides the required functionality.

nb/ we name this service veyra 
