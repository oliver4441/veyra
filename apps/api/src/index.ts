import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { authRoutes } from './routes/auth';
import { movieRoutes } from './routes/movies';
import { searchRoutes } from './routes/search';
import { watchRoutes } from './routes/watch';
import { adminRoutes } from './routes/admin';
import { genreRoutes } from './routes/genres';
import { storageRoutes } from './routes/storage';
import { getDb } from './lib/db';
import { storageAccounts } from './db/schema';

// Environment bindings
export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
}

// Create the main app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware - allow frontend origins
app.use('*', cors({
  origin: (c) => {
    try {
      const allowedOrigins = c.env?.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://web-jade-one-82.vercel.app',
        'https://veyra.vercel.app',
      ];
      const origin = c.req.header('Origin') || '';
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
  version: '0.1.0',
  status: 'ok',
  environment: c.env.ENVIRONMENT || 'development',
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes
app.route('/api/auth', authRoutes);
app.route('/api/movies', movieRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/genres', genreRoutes);

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

// Protected routes (require JWT)
app.use('/api/watch/*', jwt({ secret: (c) => c.env.JWT_SECRET, alg: 'HS256' }));
app.use('/api/admin/*', jwt({ secret: (c) => c.env.JWT_SECRET, alg: 'HS256' }));
app.use('/api/storage/*', jwt({ secret: (c) => c.env.JWT_SECRET, alg: 'HS256' }));
app.route('/api/watch', watchRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/storage', storageRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
