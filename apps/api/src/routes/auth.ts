import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { verifyFirebaseToken, type FirebaseTokenPayload } from '../lib/auth';
import { getOrCreateUser, publicUser } from '../lib/users';
import { users } from '../db/schema';
import type { Env } from '../index';

const auth = new Hono<{ Bindings: Env }>();

/** Read + verify the Firebase ID token from the Authorization header. */
async function authenticate(c: Context<{ Bindings: Env }>): Promise<FirebaseTokenPayload | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
}

// POST /api/auth/firebase — Exchange a Firebase ID token for a Veyra session.
// The ID token itself acts as the access token on every subsequent request.
auth.post('/firebase', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { idToken } = body;

  if (!idToken) {
    return c.json({ error: 'idToken is required' }, 400);
  }

  const payload = await verifyFirebaseToken(idToken, c.env.FIREBASE_PROJECT_ID);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const { user, isNewUser } = await getOrCreateUser(db, payload, c.env.ADMIN_EMAILS || '');

  return c.json({ user: publicUser(user), isNewUser });
});

// GET /api/auth/me - Get current user (upserts the Veyra account on first sync)
auth.get('/me', async (c) => {
  const payload = await authenticate(c);
  if (!payload) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const db = getDb(c.env.DATABASE_URL);
  const { user } = await getOrCreateUser(db, payload, c.env.ADMIN_EMAILS || '');

  return c.json({ user: publicUser(user) });
});

// PATCH /api/auth/profile - Update profile
auth.patch('/profile', async (c) => {
  const payload = await authenticate(c);
  if (!payload) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const db = getDb(c.env.DATABASE_URL);
  const body = await c.req.json();
  const { displayName, avatarUrl } = body;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, payload.sub))
    .limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (displayName !== undefined) updates.displayName = String(displayName).slice(0, 100);
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  await db.update(users).set(updates).where(eq(users.id, user.id));

  const [updated] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return c.json({ user: publicUser(updated) });
});

export { auth as authRoutes };
