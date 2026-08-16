// Veyra Mock Database
// A localStorage-backed store that mirrors the backend data model so the
// frontend works end-to-end without the API. Seed data is cinematic-style
// placeholder content (original titles, public-domain style descriptions).

export interface MockGenre {
  id: number;
  name: string;
  slug: string;
}

export interface MockEpisode {
  id: number;
  seasonId: number;
  episodeNumber: number;
  title: string;
  description?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface MockSeason {
  id: number;
  seriesId: number;
  seasonNumber: number;
  title?: string;
  description?: string;
  episodes?: MockEpisode[];
}

export interface MockMovie {
  id: number;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  type: 'movie' | 'series';
  year?: number;
  duration?: number;
  rating?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  tags?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  status: string;
  featured?: boolean;
  trending?: boolean;
  viewCount?: number;
  availableQualities?: string[];
  genreIds: number[];
  genres?: MockGenre[];
  seasons?: MockSeason[];
  createdAt: string;
  updatedAt: string;
}

export interface MockUser {
  id: number;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface MockSession {
  accessToken: string;
  refreshToken: string;
  user: MockUser;
}

export interface MockWatchProgress {
  id: number;
  userId: number;
  movieId?: number;
  episodeId?: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

export interface MockWatchlistEntry {
  id: number;
  userId: number;
  movieId: number;
  addedAt: string;
}

export interface MockHistoryEntry {
  id: number;
  userId: number;
  movieId: number;
  episodeId?: number;
  watchedAt: string;
  progress: number; // percent 0-100
}

export interface MockSettings {
  defaultQuality: string;
  autoplayNext: boolean;
  subtitlesEnabled: boolean;
  downloadPreference: string;
}

export interface MockJob {
  id: number;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  movieId?: number;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface MockAuditEntry {
  id: number;
  userId?: number;
  username?: string;
  action: string;
  target?: string;
  details?: string;
  createdAt: string;
}

export interface MockDB {
  version: number;
  genres: MockGenre[];
  movies: MockMovie[];
  users: MockUser[];
  session: MockSession | null;
  progress: MockWatchProgress[];
  watchlist: MockWatchlistEntry[];
  history: MockHistoryEntry[];
  settings: MockSettings;
  jobs: MockJob[];
  audit: MockAuditEntry[];
}

const DB_KEY = 'veyra-mock-db-v1';
const DB_VERSION = 1;

// ── Utilities ──────────────────────────────────────────────────────────────

let nextId = 1000;
export function uid(): number {
  return ++nextId;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function poster(slug: string): string {
  return `https://picsum.photos/seed/${slug}/400/600`;
}

export function backdrop(slug: string): string {
  return `https://picsum.photos/seed/${slug}b/1280/720`;
}

// ── Seed data ──────────────────────────────────────────────────────────────

const seedGenres: MockGenre[] = [
  { id: 1, name: 'Action', slug: 'action' },
  { id: 2, name: 'Adventure', slug: 'adventure' },
  { id: 3, name: 'Animation', slug: 'animation' },
  { id: 4, name: 'Comedy', slug: 'comedy' },
  { id: 5, name: 'Crime', slug: 'crime' },
  { id: 6, name: 'Documentary', slug: 'documentary' },
  { id: 7, name: 'Drama', slug: 'drama' },
  { id: 8, name: 'Fantasy', slug: 'fantasy' },
  { id: 9, name: 'Horror', slug: 'horror' },
  { id: 10, name: 'Mystery', slug: 'mystery' },
  { id: 11, name: 'Romance', slug: 'romance' },
  { id: 12, name: 'Sci-Fi', slug: 'sci-fi' },
  { id: 13, name: 'Thriller', slug: 'thriller' },
  { id: 14, name: 'War', slug: 'war' },
  { id: 15, name: 'Western', slug: 'western' },
];

interface SeedMovieInput {
  id: number;
  title: string;
  description: string;
  shortDescription: string;
  type?: 'movie' | 'series';
  year: number;
  duration?: number;
  rating?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  tags?: string[];
  genreIds: number[];
  featured?: boolean;
  trending?: boolean;
  viewCount?: number;
  status?: string;
}

function makeMovie(input: SeedMovieInput): MockMovie {
  const slug = slugify(input.title);
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    slug,
    description: input.description,
    shortDescription: input.shortDescription,
    type: input.type || 'movie',
    year: input.year,
    duration: input.duration,
    rating: input.rating || 'PG-13',
    imdbRating: input.imdbRating,
    director: input.director,
    cast: input.cast,
    tags: input.tags,
    posterUrl: poster(slug),
    backdropUrl: backdrop(slug),
    trailerUrl: '',
    status: input.status || 'published',
    featured: input.featured,
    trending: input.trending,
    viewCount: input.viewCount || 0,
    availableQualities: ['480', '720', '1080'],
    genreIds: input.genreIds,
    genres: input.genreIds
      .map((gid) => seedGenres.find((g) => g.id === gid))
      .filter(Boolean) as MockGenre[],
    createdAt: now,
    updatedAt: now,
  };
}

const seedMovies: MockMovie[] = [
  makeMovie({
    id: 1,
    title: 'The Midnight Echo',
    description:
      'When a mysterious signal disrupts global communications, a rogue cryptographer must decode the truth before the silence becomes permanent.',
    shortDescription:
      'A rogue cryptographer races to decode a signal that is silencing the world.',
    year: 2024,
    duration: 8100,
    rating: 'PG-13',
    imdbRating: 8.5,
    director: 'Amara Chen',
    cast: ['Jordan Reyes', 'Priya Nair', 'Tom Okafor'],
    tags: ['cryptography', 'conspiracy', 'signal'],
    genreIds: [12, 13],
    featured: true,
    trending: true,
    viewCount: 128400,
  }),
  makeMovie({
    id: 2,
    title: 'Shadow Protocol',
    description:
      'A disavowed agent returns to dismantle the covert program that created her, one carefully planned strike at a time.',
    shortDescription:
      'A disavowed agent dismantles the covert program that created her.',
    year: 2024,
    duration: 7200,
    rating: 'R',
    imdbRating: 7.9,
    director: 'Marcus Webb',
    cast: ['Elena Vasquez', 'Kofi Mensah', 'Dara Lindqvist'],
    tags: ['spy', 'espionage', 'thriller'],
    genreIds: [1, 13],
    trending: true,
    viewCount: 98300,
  }),
  makeMovie({
    id: 3,
    title: 'Neon Nights',
    description:
      'In a rain-soaked megacity, a street courier stumbles onto a corporate conspiracy that rewrites everything she knows about the city.',
    shortDescription:
      'A courier uncovers a conspiracy that could tear a megacity apart.',
    year: 2024,
    duration: 5400,
    rating: 'PG-13',
    imdbRating: 8.1,
    director: 'Yuki Tanaka',
    cast: ['Mei Lin', 'Rafael Costa', 'Ada Kowalski'],
    tags: ['cyberpunk', 'neon', 'megacity'],
    genreIds: [12, 1, 5],
    trending: true,
    viewCount: 76500,
  }),
  makeMovie({
    id: 4,
    title: 'Crimson Horizon',
    description:
      'Two estranged siblings inherit a failing vineyard and must confront the secrets of their family legacy before the harvest is lost.',
    shortDescription:
      'Estranged siblings fight to save their family vineyard and its secrets.',
    year: 2023,
    duration: 6300,
    rating: 'PG-13',
    imdbRating: 7.4,
    director: 'Isabella Rossi',
    cast: ['Marco Bellini', 'Sofia Marchetti'],
    tags: ['family', 'vineyard', 'drama'],
    genreIds: [7, 11],
    viewCount: 45200,
  }),
  makeMovie({
    id: 5,
    title: 'Quantum Drift',
    description:
      'A deep-space salvage crew finds a derelict ship that should not exist — and a stowaway who knows far too much about their own future.',
    shortDescription:
      'A salvage crew boards a derelict ship carrying a mysterious stowaway.',
    year: 2024,
    duration: 3600,
    rating: 'PG-13',
    imdbRating: 8.3,
    director: 'Elena Petrov',
    cast: ['Sam Whitfield', 'Nia Okoye', 'Hans Gruber'],
    tags: ['space', 'time', 'salvage'],
    genreIds: [12, 2, 13],
    trending: true,
    viewCount: 61200,
  }),
  makeMovie({
    id: 6,
    title: 'The Last Signal',
    description:
      'As the world falls silent, a lighthouse keeper and a young radio engineer hold the line against an encroaching darkness.',
    shortDescription:
      'A lighthouse keeper and a radio engineer resist a world going dark.',
    year: 2024,
    duration: 7800,
    rating: 'PG-13',
    imdbRating: 7.8,
    director: 'Owen Gallagher',
    cast: ['Freya Holm', 'James Carter', 'Leila Abbasi'],
    tags: ['post-apocalyptic', 'signal', 'survival'],
    genreIds: [7, 13, 12],
    viewCount: 51900,
  }),
  makeMovie({
    id: 7,
    title: 'Ironclad',
    description:
      'A former champion boxer takes one last fight to save the gym that raised him and the kids who call it home.',
    shortDescription:
      'A retired boxer steps back into the ring to save his community gym.',
    year: 2023,
    duration: 6900,
    rating: 'R',
    imdbRating: 7.6,
    director: 'Darnell Brooks',
    cast: ['Tyrone Jackson', 'Alicia Grant'],
    tags: ['boxing', 'redemption', 'sport'],
    genreIds: [7, 1],
    viewCount: 38700,
  }),
  makeMovie({
    id: 8,
    title: 'Paper Moons',
    description:
      'A lonely animator discovers her drawings come to life at night, leading her into an adventure through the city she thought she knew.',
    shortDescription:
      'An animator\'s drawings come to life and lead her across the city.',
    year: 2024,
    duration: 5700,
    rating: 'PG',
    imdbRating: 8.0,
    director: 'Chloe Dubois',
    cast: ['Ava Sinclair', 'Noah Kim'],
    tags: ['animation', 'magical', 'imagination'],
    genreIds: [3, 8, 7],
    featured: true,
    viewCount: 44100,
  }),
  makeMovie({
    id: 9,
    title: 'Blackwater Bay',
    description:
      'A small-town sheriff unravels a decades-old disappearance that the whole town agreed to forget.',
    shortDescription:
      'A sheriff digs into a disappearance the whole town agreed to forget.',
    year: 2023,
    duration: 7500,
    rating: 'R',
    imdbRating: 8.2,
    director: 'Hannah Mercer',
    cast: ['Bill Thornton', 'Grace Osei', 'Victor Adjei'],
    tags: ['noir', 'mystery', 'small-town'],
    genreIds: [10, 5, 13],
    viewCount: 56400,
  }),
  makeMovie({
    id: 10,
    title: 'Starlight Express',
    description:
      'A retired jazz musician takes a cross-country train journey and reconnects with the life he left behind.',
    shortDescription:
      'A retired jazz musician finds his way back on a cross-country train.',
    year: 2024,
    duration: 6600,
    rating: 'PG',
    imdbRating: 7.7,
    director: 'Samuel Osei',
    cast: ['Dexter Cole', 'Renee Fontaine'],
    tags: ['jazz', 'train', 'musician'],
    genreIds: [7, 11],
    viewCount: 31500,
  }),
  makeMovie({
    id: 11,
    title: 'The Silent Garden',
    description:
      'A grieving botanist inherits a greenhouse where every plant holds a memory — and one holds a dangerous secret.',
    shortDescription:
      'A botanist inherits a greenhouse where plants hold dangerous memories.',
    year: 2023,
    duration: 5400,
    rating: 'PG-13',
    imdbRating: 7.2,
    director: 'Elena Popescu',
    cast: ['Margot Fields', 'Ravi Chandra'],
    tags: ['botany', 'grief', 'garden'],
    genreIds: [7, 10],
    viewCount: 22400,
  }),
  makeMovie({
    id: 12,
    title: 'Velocity',
    description:
      'A getaway driver with a photographic memory takes one final job to clear her name — and the job is a trap.',
    shortDescription:
      'A getaway driver\'s final job turns out to be a trap.',
    year: 2024,
    duration: 6000,
    rating: 'R',
    imdbRating: 7.5,
    director: 'Kazuo Mori',
    cast: ['Lena Cruz', 'Andre Baptiste', 'Mia Novak'],
    tags: ['heist', 'car', 'driver'],
    genreIds: [1, 5, 13],
    trending: true,
    viewCount: 70300,
  }),
  makeMovie({
    id: 13,
    title: 'Meridian',
    description:
      'A cartographer discovers a city that appears on no map — and vanishes from every memory except hers.',
    shortDescription:
      'A cartographer finds a city that exists on no map.',
    year: 2024,
    duration: 7200,
    rating: 'PG-13',
    imdbRating: 8.4,
    director: 'Inez Alvarez',
    cast: ['Paloma Reyes', 'Erik Hansen', 'Zoe Adams'],
    tags: ['maps', 'lost-city', 'mystery'],
    genreIds: [8, 10, 2],
    featured: true,
    viewCount: 58800,
  }),
  makeMovie({
    id: 14,
    title: 'Wolves of Winter',
    description:
      'Trapped by an early blizzard, two rival hunting families must work together to survive the longest night of the year.',
    shortDescription:
      'Rival families must survive together through a brutal winter night.',
    year: 2023,
    duration: 6900,
    rating: 'R',
    imdbRating: 7.3,
    director: 'Bjorn Larsen',
    cast: ['Erik Lund', 'Anna Winter'],
    tags: ['winter', 'survival', 'wilderness'],
    genreIds: [7, 2, 14],
    viewCount: 29800,
  }),
  makeMovie({
    id: 15,
    title: 'Gravity Well',
    description:
      'An orbital station engineer is the last person awake as the station begins a slow, irreversible fall toward the planet below.',
    shortDescription:
      'An engineer races to save her station from falling out of orbit.',
    year: 2024,
    duration: 6000,
    rating: 'PG-13',
    imdbRating: 7.9,
    director: 'Sofia Lindqvist',
    cast: ['Nadia Rahman', 'Oscar Finch'],
    tags: ['space', 'orbital', 'thriller'],
    genreIds: [12, 13],
    viewCount: 47600,
  }),
  makeMovie({
    id: 16,
    title: 'Laugh Track',
    description:
      'A failed stand-up comedian inherits a haunted comedy club where the ghost of a legend refuses to stop heckling from the back row.',
    shortDescription:
      'A comedian inherits a comedy club haunted by a heckling ghost.',
    year: 2024,
    duration: 5700,
    rating: 'PG-13',
    imdbRating: 7.0,
    director: 'Tony Alvarez',
    cast: ['Danny Russo', 'Betty Chang'],
    tags: ['comedy', 'haunted', 'stand-up'],
    genreIds: [4, 9],
    viewCount: 35600,
  }),
];

// Series with seasons & episodes
function buildSeries(
  input: SeedMovieInput,
  seasonCount: number,
  episodesPerSeason: number
): MockMovie {
  const movie = makeMovie(input);
  const now = new Date().toISOString();
  const seasons: MockSeason[] = [];
  let epId = 10000;
  for (let s = 1; s <= seasonCount; s++) {
    const seasonId = input.id * 100 + s;
    const episodes: MockEpisode[] = [];
    for (let e = 1; e <= episodesPerSeason; e++) {
      episodes.push({
        id: epId++,
        seasonId,
        episodeNumber: e,
        title: `Episode ${e}`,
        description: `${movie.title} — episode ${e}.`,
        duration: 2700 + ((e * 137) % 900),
        thumbnailUrl: `https://picsum.photos/seed/${movie.slug}-s${s}e${e}/640/360`,
      });
    }
    seasons.push({
      id: seasonId,
      seriesId: input.id,
      seasonNumber: s,
      title: `Season ${s}`,
      episodes,
    });
  }
  return {
    ...movie,
    seasons,
    createdAt: now,
    updatedAt: now,
  };
}

const seriesDefs: Array<[SeedMovieInput, number, number]> = [
  [
    {
      id: 21,
      title: 'Event Horizon Protocol',
      description:
        'A crack team of engineers manages the machine that keeps reality stable — and someone keeps trying to break it.',
      shortDescription:
        'A team defends the machine that keeps reality from collapsing.',
      type: 'series',
      year: 2024,
      duration: 3000,
      rating: 'TV-14',
      imdbRating: 8.6,
      director: 'Grace Nakamura',
      cast: ['Owen Park', 'Sana Ali', 'Felix Braun'],
      tags: ['sci-fi', 'reality', 'team'],
      genreIds: [12, 13, 7],
      trending: true,
      viewCount: 88900,
    },
    3,
    6,
  ],
  [
    {
      id: 22,
      title: 'Harbor Lights',
      description:
        'A coastal detective returns to her hometown and finds that every case she solves keeps pointing back to her own family.',
      shortDescription:
        'A detective\'s cases keep pointing back to her own family.',
      type: 'series',
      year: 2023,
      duration: 2700,
      rating: 'TV-MA',
      imdbRating: 8.1,
      director: 'Mia Johansson',
      cast: ['Kate Donovan', 'Tom Ellis', 'Priya Sharma'],
      tags: ['crime', 'detective', 'coastal'],
      genreIds: [5, 10, 7],
      viewCount: 61200,
    },
    2,
    8,
  ],
  [
    {
      id: 23,
      title: 'The Cartographers',
      description:
        'Every night, three strangers share the same dream: a map of a city that none of them have ever visited. Then one of them finds it.',
      shortDescription:
        'Strangers share a dream of a city that turns out to be real.',
      type: 'series',
      year: 2024,
      duration: 3300,
      rating: 'TV-14',
      imdbRating: 8.8,
      director: 'Alicia Ng',
      cast: ['Jonah West', 'Mara Silva', 'Ivan Petrov'],
      tags: ['fantasy', 'dreams', 'city'],
      genreIds: [8, 10, 7],
      featured: true,
      viewCount: 93400,
    },
    2,
    6,
  ],
];

const seedUsers: MockUser[] = [
  {
    id: 1,
    email: 'admin@veyra.app',
    username: 'admin',
    displayName: 'Veyra Admin',
    avatarUrl: '',
    role: 'admin',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    email: 'demo@veyra.app',
    username: 'demo',
    displayName: 'Demo Viewer',
    avatarUrl: '',
    role: 'user',
    createdAt: '2024-02-01T09:30:00Z',
  },
  {
    id: 3,
    email: 'kim@veyra.app',
    username: 'kimwatu',
    displayName: 'Kim Watu',
    avatarUrl: '',
    role: 'user',
    createdAt: '2024-03-12T14:20:00Z',
  },
  {
    id: 4,
    email: 'aisha@veyra.app',
    username: 'aisha',
    displayName: 'Aisha Bello',
    avatarUrl: '',
    role: 'user',
    createdAt: '2024-04-05T11:00:00Z',
  },
];

// Seed progress/watchlist/history for the demo user (id 2)
const seedProgress: MockWatchProgress[] = [
  {
    id: 1,
    userId: 2,
    movieId: 1,
    position: 2920,
    duration: 8100,
    completed: false,
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 2,
    userId: 2,
    movieId: 5,
    position: 1180,
    duration: 3600,
    completed: false,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 3,
    userId: 2,
    episodeId: 10001,
    movieId: 21,
    position: 1540,
    duration: 3000,
    completed: false,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
];

const seedWatchlist: MockWatchlistEntry[] = [
  { id: 1, userId: 2, movieId: 3, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
  { id: 2, userId: 2, movieId: 13, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
  { id: 3, userId: 2, movieId: 22, addedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
];

const seedHistory: MockHistoryEntry[] = [
  { id: 1, userId: 2, movieId: 8, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), progress: 100 },
  { id: 2, userId: 2, movieId: 16, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), progress: 100 },
  { id: 3, userId: 2, movieId: 1, watchedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), progress: 36 },
  { id: 4, userId: 2, movieId: 5, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), progress: 33 },
  { id: 5, userId: 2, movieId: 21, watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), progress: 51 },
];

const seedJobs: MockJob[] = [
  {
    id: 1,
    type: 'upload',
    status: 'completed',
    progress: 100,
    movieId: 15,
    fileName: 'gravity-well-1080p.mp4',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
  {
    id: 2,
    type: 'transcode',
    status: 'processing',
    progress: 64,
    movieId: 12,
    fileName: 'velocity-4k.mkv',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 3,
    type: 'thumbnail',
    status: 'queued',
    progress: 0,
    movieId: 16,
    fileName: 'laugh-track.mp4',
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: 4,
    type: 'upload',
    status: 'failed',
    progress: 12,
    movieId: 14,
    fileName: 'wolves-of-winter-1080p.mp4',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    error: 'Upload interrupted — provider returned 503. Retry recommended.',
  },
];

const seedAudit: MockAuditEntry[] = [
  { id: 1, userId: 1, username: 'admin', action: 'movie.create', target: 'The Midnight Echo', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
  { id: 2, userId: 1, username: 'admin', action: 'movie.update', target: 'Quantum Drift', details: 'Set trending=true', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString() },
  { id: 3, userId: 2, username: 'demo', action: 'auth.login', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 4, userId: 2, username: 'demo', action: 'watch.progress', target: 'The Midnight Echo', details: 'Resumed at 36%', createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: 5, userId: 1, username: 'admin', action: 'movie.delete', target: 'Draft: Untitled 34', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
  { id: 6, userId: 3, username: 'kimwatu', action: 'auth.register', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString() },
  { id: 7, userId: 1, username: 'admin', action: 'storage.test', target: 'Cloudflare R2', details: 'Connection OK (34ms)', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
];

function createSeedDB(): MockDB {
  return {
    version: DB_VERSION,
    genres: seedGenres,
    movies: [...seedMovies, ...seriesDefs.map(([def, s, e]) => buildSeries(def, s, e))],
    users: seedUsers,
    session: null,
    progress: seedProgress,
    watchlist: seedWatchlist,
    history: seedHistory,
    settings: {
      defaultQuality: '1080',
      autoplayNext: true,
      subtitlesEnabled: true,
      downloadPreference: 'web',
    },
    jobs: seedJobs,
    audit: seedAudit,
  };
}

// ── Store ──────────────────────────────────────────────────────────────────

let cached: MockDB | null = null;

export function getDB(): MockDB {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDB;
        if (parsed && parsed.version === DB_VERSION) {
          cached = parsed;
          return cached;
        }
      }
    } catch {
      // fall through to seed
    }
  }
  cached = createSeedDB();
  return cached;
}

export function saveDB(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(cached));
  } catch {
    // storage full / unavailable — keep in-memory
  }
}

export function resetDB(): MockDB {
  cached = createSeedDB();
  saveDB();
  return cached;
}

// ── Helpers used by the mock API router ────────────────────────────────────

export function getMovieById(id: number): MockMovie | undefined {
  return getDB().movies.find((m) => m.id === id);
}

export function getMovieBySlug(slug: string): MockMovie | undefined {
  return getDB().movies.find((m) => m.slug === slug);
}

export function getGenreName(id: number): string {
  return getDB().genres.find((g) => g.id === id)?.name || '';
}

export function attachGenres(movie: MockMovie): MockMovie {
  return {
    ...movie,
    genres: movie.genreIds
      .map((gid) => getDB().genres.find((g) => g.id === gid))
      .filter(Boolean) as MockGenre[],
  };
}

export function withGenres(movies: MockMovie[]): MockMovie[] {
  return movies.map(attachGenres);
}
