import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  verifyToken,
} from '../lib/auth';
import { users, refreshTokens } from '../db/schema';
import type { Env } from '../index';

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth/register
auth.post('/register', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();

  const { email, username, password, displayName } = body;

  if (!email || !username || !password) {
    return c.json({ error: 'Email, username, and password are required' }, 400);
  }

  // Check if user exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const existingUsername = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername.length > 0) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash,
      displayName: displayName || username,
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    });

  // Generate tokens
  const tokenPayload = {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role!,
  };

  const accessToken = await createAccessToken(tokenPayload, c.env.JWT_SECRET);
  const refreshToken = await createRefreshToken(tokenPayload, c.env.JWT_SECRET, '7d');

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    userId: newUser.id,
    token: refreshToken,
    expiresAt,
  });

  return c.json({
    user: {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
    },
    accessToken,
    refreshToken,
  }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (!user.isActive) {
    return c.json({ error: 'Account is deactivated' }, 403);
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role!,
  };

  const accessToken = await createAccessToken(tokenPayload, c.env.JWT_SECRET);
  const refreshToken = await createRefreshToken(tokenPayload, c.env.JWT_SECRET, '7d');

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { refreshToken } = body;

  if (!refreshToken) {
    return c.json({ error: 'Refresh token required' }, 400);
  }

  // Verify the token
  const payload = await verifyToken(refreshToken, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  // Check if token exists in database
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .limit(1);

  if (!storedToken) {
    return c.json({ error: 'Refresh token not found' }, 401);
  }

  // Check expiry
  if (new Date(storedToken.expiresAt) < new Date()) {
    return c.json({ error: 'Refresh token expired' }, 401);
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user || !user.isActive) {
    return c.json({ error: 'User not found or deactivated' }, 401);
  }

  // Generate new tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role!,
  };

  const newAccessToken = await createAccessToken(tokenPayload, c.env.JWT_SECRET);
  const newRefreshToken = await createRefreshToken(tokenPayload, c.env.JWT_SECRET, '7d');

  // Replace refresh token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: newRefreshToken,
    expiresAt,
  });

  return c.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { refreshToken } = body;

  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  return c.json({ message: 'Logged out' });
});

// GET /api/auth/me - Get current user
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const db = getDb(c.env.DATABASE_URL);
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

export { auth as authRoutes };
