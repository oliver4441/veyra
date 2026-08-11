import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
import { authRoutes } from './routes/auth';
import { movieRoutes } from './routes/movies';
import { searchRoutes } from './routes/search';
import { watchRoutes } from './routes/watch';
import { adminRoutes } from './routes/admin';
import { genreRoutes } from './routes/genres';

// Environment bindings
export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
}

// Create the main app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware - allow frontend origins
app.use('*', cors({
  origin: (c) => {
    const allowedOrigins = c.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://veyra.vercel.app',
    ];
    const origin = c.req.header('Origin') || '';
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
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

// Protected routes (require JWT)
app.use('/api/watch/*', jwt({ secret: (c) => c.env.JWT_SECRET }));
app.use('/api/admin/*', jwt({ secret: (c) => c.env.JWT_SECRET }));
app.route('/api/watch', watchRoutes);
app.route('/api/admin', adminRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
