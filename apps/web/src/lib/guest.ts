// ─────────────────────────────────────────────────────────────────────────────
// Guest identity — the replacement for accounts
// ─────────────────────────────────────────────────────────────────────────────
// Veyra no longer has sign-up or sign-in. Instead every install gets:
//
//   • a device id — an opaque random string generated once and stored locally.
//     When the API is configured it is sent as `X-Veyra-Device-Id`, which lets
//     the backend keep a watchlist/progress row per device without ever asking
//     for an email address or password. Nothing about the device is revealed.
//   • a display name — purely cosmetic, editable in Preferences, never leaves
//     the device.
//
// If the device id is lost (cleared browser data, fresh install) the local
// library still works; only server-side sync restarts from empty.
// ─────────────────────────────────────────────────────────────────────────────

const DEVICE_KEY = 'veyra-device-id';
const PROFILE_KEY = 'veyra-guest-profile-v1';

export interface GuestProfile {
  deviceId: string;
  displayName: string;
  createdAt: number;
}

function randomId(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback for older WebViews.
  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = `dev_${randomId()}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    // Storage blocked — use an in-memory id for this session only.
    return `dev_${randomId()}`;
  }
}

export function getProfile(): GuestProfile {
  const deviceId = getDeviceId();
  if (typeof window === 'undefined') {
    return { deviceId, displayName: 'Guest', createdAt: Date.now() };
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestProfile>;
      return {
        deviceId,
        displayName: parsed.displayName || 'Guest',
        createdAt: parsed.createdAt || Date.now(),
      };
    }
  } catch {
    // fall through to a fresh profile
  }
  const profile: GuestProfile = { deviceId, displayName: 'Guest', createdAt: Date.now() };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
  return profile;
}

export function setDisplayName(displayName: string): GuestProfile {
  const profile = { ...getProfile(), displayName: displayName.trim().slice(0, 40) || 'Guest' };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }
  return profile;
}

export function resetDeviceData() {
  if (typeof window === 'undefined') return;
  [DEVICE_KEY, PROFILE_KEY, 'veyra-my-list-v1', 'veyra-progress-v1', 'veyra-access-token'].forEach(
    (key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  );
}
