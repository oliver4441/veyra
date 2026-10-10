import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { movieRoutes } from './routes/movies';
import { searchRoutes } from './routes/search';
import { watchRoutes } from './routes/watch';
import { adminRoutes } from './routes/admin';
import { genreRoutes } from './routes/genres';
import { storageRoutes } from './routes/storage';
import { discoveryRoutes } from './routes/discovery';
import { ratingsRoutes } from './routes/ratings';
import { providerRoutes } from './routes/providers';
import { getDb } from './lib/db';
import { verifyFirebaseToken, type FirebaseTokenPayload } from './lib/auth';
import {
  getOrCreateUser,
  getOrCreateGuestUser,
  getOrCreateAdminKeyUser,
  safeEqual,
} from './lib/users';
import { storageAccounts } from './db/schema';

// Environment bindings
export interface Env {
  DATABASE_URL: string;
  /** Firebase project id — used to verify ID token iss/aud claims */
  FIREBASE_PROJECT_ID: string;
  /** Comma-separated emails that should be promoted to admin on sign-in */
  ADMIN_EMAILS?: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
  TMDB_API_READ_ACCESS_TOKEN: string;
  /**
   * Operator key that unlocks /api/admin/*. Required in production: when it is
   * missing the admin surface fails closed rather than falling back to "anyone".
   */
  ADMIN_ACCESS_KEY?: string;
  /** Set to "false" to switch guest (accountless) access off. Default: on. */
  GUEST_MODE?: string;
  /** Optional server-side YouTube Data API key (kept out of the browser). */
  YOUTUBE_API_KEY?: string;
}

// Shared context variables set by auth middleware
export interface AppVariables {
  jwtPayload: FirebaseTokenPayload;
  /** Veyra user id (from the users table) */
  userId: number;
  userRole: string;
  /** How this caller proved who they are. */
  authKind: 'firebase' | 'admin-key' | 'guest';
}

export type AppContext = { Bindings: Env; Variables: AppVariables };

// Create the main app
const app = new Hono<AppContext>();

// ── In-memory rate limiter (per-isolate; sufficient for Workers) ─────────
const rateBuckets = new Map<string, number[]>();

function isRateLimited(c: Context, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const timestamps = (rateBuckets.get(bucketKey) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    rateBuckets.set(bucketKey, timestamps);
    return true;
  }

  timestamps.push(now);
  rateBuckets.set(bucketKey, timestamps);
  return false;
}

// CORS middleware - allow frontend origins
app.use('*', cors({
  origin: (origin, c) => {
    try {
      const allowedOrigins = c.env?.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://web-jade-one-82.vercel.app',
        'https://veyra.vercel.app',
      ];
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    } catch {
      return '*';
    }
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // X-Veyra-Device-Id is the anonymous guest identity; X-Veyra-Admin-Key is the
  // operator credential. Both must be allowed through preflight.
  allowHeaders: ['Content-Type', 'Authorization', 'X-Veyra-Device-Id', 'X-Veyra-Admin-Key'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'veyra-api',
  version: '0.3.0',
  auth: 'accountless (device id) + optional Firebase / admin key',
  status: 'ok',
  environment: c.env.ENVIRONMENT || 'development',
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes
app.route('/api/auth', authRoutes);
app.route('/api/movies', movieRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/genres', genreRoutes);
app.route('/api/discovery', discoveryRoutes);

// Test R2 endpoint
app.get('/api/test-r2', async (c) => {
  try {
    const bucket = c.env.R2_BUCKET;
    if (!bucket) {
      return c.json({ error: 'R2_BUCKET not available' });
    }
    const listed = await bucket.list({ limit: 10 });
    return c.json({
      success: true,
      bucketExists: true,
      objects: listed.objects.map(o => o.key)
    });
  } catch (error: any) {
    return c.json({ error: error.message });
  }
});

// Test database endpoint
app.get('/api/test-db', async (c) => {
  try {
    const db = getDb(c.env.DATABASE_URL);
    const result = await db.select().from(storageAccounts).limit(1);
    return c.json({ success: true, accounts: result });
  } catch (error: any) {
    return c.json({ error: error.message });
  }
});

function guestModeEnabled(c: Context<AppContext>): boolean {
  return (c.env.GUEST_MODE || 'true').toLowerCase() !== 'false';
}

type IdentityResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 429; error: string };

/**
 * Work out who is calling.
 *
 * Veyra has no accounts, so three credentials are accepted, in priority order:
 *
 *   1. `Authorization: Bearer <Firebase ID token>` — kept for existing installs
 *      and for admins who prefer a real identity.
 *   2. `X-Veyra-Admin-Key` — the operator key (ADMIN_ACCESS_KEY). Grants admin.
 *   3. `X-Veyra-Device-Id` — the anonymous guest identity the app generates on
 *      first launch. Grants an ordinary user row, so watchlists, resume points
 *      and ratings all keep working with no sign-up.
 *
 * With none of the three the caller is unidentified.
 */
async function resolveIdentity(c: Context<AppContext>): Promise<IdentityResult> {
  const db = getDb(c.env.DATABASE_URL);
  const authHeader = c.req.header('Authorization');

  // 1) Firebase bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = await verifyFirebaseToken(
      authHeader.slice(7),
      c.env.FIREBASE_PROJECT_ID
    );
    if (!payload) return { ok: false, status: 401, error: 'Invalid or expired token' };
    const { user } = await getOrCreateUser(db, payload, c.env.ADMIN_EMAILS || '');
    if (!user.isActive) return { ok: false, status: 403, error: 'Account is deactivated' };
    c.set('jwtPayload', payload);
    c.set('userId', user.id);
    c.set('userRole', user.role);
    c.set('authKind', 'firebase');
    return { ok: true };
  }

  // 2) Operator key
  const adminKey = c.req.header('X-Veyra-Admin-Key');
  if (adminKey && c.env.ADMIN_ACCESS_KEY) {
    if (!safeEqual(adminKey, c.env.ADMIN_ACCESS_KEY)) {
      return { ok: false, status: 403, error: 'Invalid admin key' };
    }
    if (isRateLimited(c, 'admin-key', 120, 60_000)) {
      return { ok: false, status: 429, error: 'Too many requests' };
    }
    const admin = await getOrCreateAdminKeyUser(db);
    if (!admin.isActive) {
      return { ok: false, status: 403, error: 'Admin account is deactivated' };
    }
    c.set('userId', admin.id);
    c.set('userRole', admin.role);
    c.set('authKind', 'admin-key');
    return { ok: true };
  }

  // 3) Anonymous device
  const deviceId = c.req.header('X-Veyra-Device-Id');
  if (deviceId && guestModeEnabled(c)) {
    if (isRateLimited(c, 'guest', 600, 60_000)) {
      return { ok: false, status: 429, error: 'Too many requests' };
    }
    const { user } = await getOrCreateGuestUser(db, deviceId);
    if (!user.isActive) return { ok: false, status: 403, error: 'Account is deactivated' };
    c.set('userId', user.id);
    c.set('userRole', user.role);
    c.set('authKind', 'guest');
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: guestModeEnabled(c)
      ? 'Missing X-Veyra-Device-Id (or Authorization header)'
      : 'Authentication required',
  };
}

/** Requires an identified caller. Used by watch / ratings / storage / admin. */
const identityMiddleware = async (c: Context<AppContext>, next: Next) => {
  const result = await resolveIdentity(c);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  await next();
};

/** Requires the admin role. Applied after identity so the role is known. */
const adminMiddleware = async (c: Context<AppContext>, next: Next) => {
  const role = c.get('userRole');
  if (role !== 'admin' && role !== 'superadmin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
};

/**
 * Admin endpoints that must stay reachable before anything is proven:
 * `unlock` validates the key itself and `status` reports whether the caller is
 * an admin. Everything else under /api/admin requires the admin role.
 */
const OPEN_ADMIN_PATHS = ['/api/admin/unlock', '/api/admin/status'];

const adminAreaMiddleware = async (c: Context<AppContext>, next: Next) => {
  const path = new URL(c.req.url).pathname;
  const open = OPEN_ADMIN_PATHS.includes(path);

  const result = await resolveIdentity(c);

  if (open) {
    // An identity is optional here — /status simply reports admin:false.
    return next();
  }
  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }
  const role = c.get('userRole');
  if (role !== 'admin' && role !== 'superadmin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  return next();
};

// Rate limit auth endpoints (Firebase handles credential brute-force itself;
// this protects our token-exchange and profile endpoints)
app.use('/api/auth/*', async (c, next) => {
  if (isRateLimited(c, 'auth', 60, 60_000)) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});

// Public source-provider proxy (archive.org passthrough + secret YouTube key)
app.use('/api/providers/*', async (c, next) => {
  if (isRateLimited(c, 'providers', 120, 60_000)) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});
app.route('/api/providers', providerRoutes);

// Protected routes. Identity comes from a Firebase token, the admin key, or an
// anonymous device id — see identityMiddleware.
app.use('/api/watch/*', identityMiddleware);
app.use('/api/ratings/*', identityMiddleware);
app.use('/api/storage/*', identityMiddleware, adminMiddleware);
app.use('/api/admin/*', adminAreaMiddleware);
app.route('/api/watch', watchRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/storage', storageRoutes);
app.route('/api/ratings', ratingsRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
