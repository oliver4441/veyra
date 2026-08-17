import { createRemoteJWKSet, jwtVerify } from 'jose';

// Firebase ID tokens are RS256 JWTs signed by Google's securetoken service.
// We verify them against Google's published JWKS (fetched + cached by jose).
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL), {
      timeoutDuration: 5000,
    });
  }
  return jwks;
}

export interface FirebaseTokenPayload {
  /** Firebase project issuer: https://securetoken.google.com/<projectId> */
  iss: string;
  /** Firebase project id */
  aud: string;
  /** Firebase user UID */
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  /** Unix seconds when the user last signed in */
  auth_time?: number;
  iat: number;
  exp: number;
}

/**
 * Verify a Firebase ID token. Returns the token payload when valid,
 * or null when the token is malformed, expired, or signed by another project.
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<FirebaseTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return payload as FirebaseTokenPayload;
  } catch {
    return null;
  }
}
