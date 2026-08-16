'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type User } from '@/lib/api';

// Simple auth state bus — pages listen and update when sign-in state changes.
const listeners = new Set<() => void>();

export function notifyAuthChanged() {
  listeners.forEach((fn) => fn());
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout();
    notifyAuthChanged();
    setUser(null);
  }, []);

  return { user, loading, signOut, refresh };
}
