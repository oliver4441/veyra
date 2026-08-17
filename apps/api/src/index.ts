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
import { getDb } from './lib/db';
import { verifyFirebaseToken, type FirebaseTokenPayload } from './lib/auth';
import { getOrCreateUser } from './lib/users';
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
}

// Shared context variables set by auth middleware
export interface AppVariables {
  jwtPayload: FirebaseTokenPayload;
  /** Veyra user id (from the users table, resolved from the Firebase UID) */
  userId: number;
  userRole: string;
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
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'veyra-api',
  version: '0.2.0',
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

// ── Firebase auth middleware ──────────────────────────────────────────────
// Verifies the Firebase ID token (Bearer) and resolves it to a Veyra user.
const authMiddleware = async (c: Context<AppContext>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const db = getDb(c.env.DATABASE_URL);
  const { user } = await getOrCreateUser(db, payload, c.env.ADMIN_EMAILS || '');
  if (!user.isActive) {
    return c.json({ error: 'Account is deactivated' }, 403);
  }

  c.set('jwtPayload', payload);
  c.set('userId', user.id);
  c.set('userRole', user.role);
  await next();
};

// Rate limit auth endpoints (Firebase handles credential brute-force itself;
// this protects our token-exchange and profile endpoints)
app.use('/api/auth/*', async (c, next) => {
  if (isRateLimited(c, 'auth', 60, 60_000)) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});

// Protected routes (require Firebase ID token)
app.use('/api/watch/*', authMiddleware);
app.use('/api/admin/*', authMiddleware);
app.use('/api/storage/*', authMiddleware);
app.use('/api/ratings/*', authMiddleware);
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
