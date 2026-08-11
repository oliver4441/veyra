import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

export interface AuthPayload extends JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export async function createAccessToken(
  payload: { userId: number; email: string; role: string },
  secret: string,
  expiresIn = '15m'
): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);

  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(String(payload.userId))
    .sign(key);
}

export async function createRefreshToken(
  payload: { userId: number; email: string; role: string },
  secret: string,
  expiresIn = '7d'
): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);

  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(String(payload.userId))
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<AuthPayload | null> {
  try {
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

// Simple password hashing using Web Crypto API (available in Workers)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import password as key
  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive bits
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(bits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Return salt + hash
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, expectedHash] = storedHash.split(':');
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  const hashArray = Array.from(new Uint8Array(bits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex === expectedHash;
}
