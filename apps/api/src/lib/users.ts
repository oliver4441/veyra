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

// ─────────────────────────────────────────────────────────────────────────────
// Accountless identities
// ─────────────────────────────────────────────────────────────────────────────
// Veyra has no sign-up and no sign-in. Two kinds of caller still need a row in
// `users` so the existing watchlist / progress / ratings tables keep working:
//
//   • a guest — identified only by an opaque device id the app generates locally
//   • an admin — identified by the ADMIN_ACCESS_KEY shared secret
//
// Neither carries an email address or password. The synthetic addresses below
// exist purely to satisfy the unique NOT NULL columns; they are never sent to
// anyone and cannot be used to sign in.
// ─────────────────────────────────────────────────────────────────────────────

const GUEST_DOMAIN = 'device.veyra.local';
const ADMIN_KEY_EMAIL = 'admin-key@veyra.local';

/** Keep the device id out of the email/username by hashing it lightly. */
function hashDeviceId(deviceId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < deviceId.length; i++) {
    hash ^= deviceId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // 32-bit FNV-1a is plenty: collisions only merge two anonymous watchlists.
  return (hash >>> 0).toString(36);
}

/**
 * Resolve (or create) the guest row for one device.
 * Safe to call on every request — it is a single indexed lookup in the common
 * case.
 */
export async function getOrCreateGuestUser(
  db: Database,
  deviceId: string
): Promise<{ user: UserRow; isNewUser: boolean }> {
  const normalized = deviceId.trim().slice(0, 128);
  if (!normalized) {
    throw new Error('A device id is required for guest access');
  }
  const email = `${hashDeviceId(normalized)}@${GUEST_DOMAIN}`;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { user: existing, isNewUser: false };

  const username = `guest_${hashDeviceId(normalized)}`;
  const [created] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash: null,
      firebaseUid: null,
      emailVerified: false,
      displayName: 'Guest',
      avatarUrl: null,
      role: 'user',
    })
    .returning();

  return { user: created, isNewUser: true };
}

/**
 * Resolve (or create) the single shared admin row used by ADMIN_ACCESS_KEY.
 * Deliberately one row for the whole deployment: the key is an operator
 * credential, not a per-person account.
 */
export async function getOrCreateAdminKeyUser(db: Database): Promise<UserRow> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_KEY_EMAIL))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      email: ADMIN_KEY_EMAIL,
      username: 'admin_key',
      passwordHash: null,
      firebaseUid: null,
      emailVerified: false,
      displayName: 'Operator',
      avatarUrl: null,
      role: 'admin',
    })
    .returning();
  return created;
}

/** Constant-time-ish comparison so key guessing cannot be timed. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
