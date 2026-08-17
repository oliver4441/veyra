'use client';

import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api, setTokenProvider, clearLegacySession, type User } from '@/lib/api';

// Simple auth state bus — pages listen and update when sign-in state changes.
const listeners = new Set<() => void>();

export function notifyAuthChanged() {
  listeners.forEach((fn) => fn());
}

/**
 * Auth state hook. Drives everything from Firebase Auth:
 * - registers the ID-token provider so every API call sends a fresh token
 * - syncs the Veyra user profile on sign-in (upserts on first visit)
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (fbu: FirebaseUser | null) => {
    if (!fbu) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.getMe();
      setUser(me);
    } catch {
      // API unreachable — fall back to the Firebase profile shape
      setUser({
        id: 0,
        email: fbu.email || '',
        username: fbu.displayName || fbu.email?.split('@')[0] || 'user',
        displayName: fbu.displayName || undefined,
        avatarUrl: fbu.photoURL || undefined,
        role: 'user',
        emailVerified: fbu.emailVerified,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Register the token provider: every request resolves a fresh ID token.
    setTokenProvider(async () => {
      const current = auth.currentUser;
      if (!current) return null;
      try {
        return await current.getIdToken(false);
      } catch {
        return null;
      }
    });
    clearLegacySession();

    const unsubscribe = onAuthStateChanged(auth, async (fbu) => {
      setFbUser(fbu);
      await refresh(fbu);
      notifyAuthChanged();
    });

    return () => {
      unsubscribe();
      setTokenProvider(null);
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    // Firebase sign-out fires onAuthStateChanged which clears state
  }, []);

  return { user, fbUser, loading, signOut, refresh: () => refresh(auth.currentUser) };
}
