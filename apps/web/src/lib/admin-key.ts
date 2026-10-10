// ─────────────────────────────────────────────────────────────────────────────
// Admin key — the only credential left in Veyra
// ─────────────────────────────────────────────────────────────────────────────
// Removing sign-up must not mean removing the lock on the admin dashboard. The
// public app stays public; the admin surface stays behind a key that is checked
// server-side against ADMIN_ACCESS_KEY (or, in mock/demo mode, a documented
// development key).
//
// The key is kept in sessionStorage, not localStorage: closing the tab locks the
// admin area again, which is the right default on a shared machine.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'veyra-admin-key';

/** Development key accepted by the in-browser mock backend only. */
export const DEMO_ADMIN_KEY = 'veyra-admin-dev';

export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function storeAdminKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, key);
  } catch {
    // ignore
  }
}

export function clearAdminKey() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export interface UnlockResult {
  ok: boolean;
  error?: string;
  /** Which backend validated the key — useful for the admin UI. */
  mode?: 'api' | 'demo';
}

/**
 * Validate a key. The real check happens server-side; the mock backend accepts
 * the documented development key so the dashboard is explorable offline.
 */
export async function unlockAdmin(key: string): Promise<UnlockResult> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: 'Enter your admin key.' };

  try {
    const { api } = await import('./api');
    const res = await api.request<{ success: boolean; mode?: string; error?: string }>(
      '/api/admin/unlock',
      { method: 'POST', body: JSON.stringify({ key: trimmed }) }
    );
    if (res.success) {
      storeAdminKey(trimmed);
      return { ok: true, mode: (res.mode as 'api' | 'demo') || 'api' };
    }
    return { ok: false, error: res.error || 'That key was rejected.' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not reach the admin service.',
    };
  }
}
