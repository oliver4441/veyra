import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import type { Database } from './db';
import type { FirebaseTokenPayload } from './auth';

export interface PublicUser {
  id: number;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin' | 'superadmin';
  emailVerified: boolean;
  createdAt: Date;
}

type UserRow = typeof users.$inferSelect;

export function publicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

/**
 * Resolve a verified Firebase account to a Veyra user row, creating one on
 * first sign-in (and linking legacy accounts by email). Admin emails listed
 * in the ADMIN_EMAILS env var are promoted on first sync.
 */
export async function getOrCreateUser(
  db: Database,
  payload: FirebaseTokenPayload,
  adminEmails: string
): Promise<{ user: UserRow; isNewUser: boolean }> {
  const uid = payload.sub;
  const email = (payload.email || '').toLowerCase();
  const adminList = adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const shouldBeAdmin = adminList.includes(email);
  const emailVerified = !!payload.email_verified;

  // 1) Match by Firebase UID
  const [byUid] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, uid))
    .limit(1);

  if (byUid) {
    // Keep role + verification fresh (never demote existing roles)
    const patch: Partial<UserRow> = { updatedAt: new Date() };
    if (shouldBeAdmin && byUid.role === 'user') patch.role = 'admin';
    if (byUid.emailVerified !== emailVerified) patch.emailVerified = emailVerified;
    if (Object.keys(patch).length > 0) {
      await db.update(users).set(patch).where(eq(users.id, byUid.id));
      return {
        user: { ...byUid, ...patch },
        isNewUser: false,
      };
    }
    return { user: byUid, isNewUser: false };
  }

  // 2) Match by email — link legacy accounts to their Firebase UID
  if (email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (byEmail) {
      const [updated] = await db
        .update(users)
        .set({
          firebaseUid: uid,
          emailVerified,
          updatedAt: new Date(),
          ...(shouldBeAdmin && byEmail.role === 'user' ? { role: 'admin' as const } : {}),
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      return { user: updated, isNewUser: false };
    }
  }

  // 3) Create a fresh account
  const baseUsername =
    (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 24) || 'user';
  let username = baseUsername;
  for (let i = 1; i < 100; i++) {
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!clash) break;
    username = `${baseUsername}${i}`;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash: null,
      firebaseUid: uid,
      emailVerified,
      displayName: payload.name || username,
      avatarUrl: payload.picture || null,
      role: shouldBeAdmin ? 'admin' : 'user',
    })
    .returning();

  return { user: newUser, isNewUser: true };
}
