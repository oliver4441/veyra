'use client';

// ─────────────────────────────────────────────────────────────────────────────
// AdminGate — the lock that survives removing accounts
// ─────────────────────────────────────────────────────────────────────────────
// Veyra is a no-signup app, but the admin dashboard must not be public: it can
// delete catalogue entries and issue upload URLs. So the admin surface is gated
// by a key that is checked server-side (ADMIN_ACCESS_KEY on the Worker, or the
// documented development key when the app is running on the in-browser mock).
//
// The key lives in sessionStorage, so closing the tab re-locks the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import {
  DEMO_ADMIN_KEY,
  clearAdminKey,
  getAdminKey,
  storeAdminKey,
} from '@/lib/admin-key';

export default function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'api' | 'demo' | null>(null);

  const verify = useCallback(async (candidate?: string) => {
    setState('checking');
    setError(null);
    try {
      const res = await api.adminStatus();
      if (res.admin) {
        setMode((res.mode as 'api' | 'demo') || 'api');
        setState('unlocked');
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the admin service.');
    }
    clearAdminKey();
    setState('locked');
    if (candidate) setKey('');
    return false;
  }, []);

  useEffect(() => {
    if (!getAdminKey()) {
      setState('locked');
      return;
    }
    void verify();
  }, [verify]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setError('Enter your admin key.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.unlockAdmin(key.trim());
      if (res.success) {
        storeAdminKey(key.trim());
        setMode((res.mode as 'api' | 'demo') || 'api');
        setState('unlocked');
        setKey('');
      } else {
        setError(res.error || 'That key was rejected.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the admin service.');
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    clearAdminKey();
    setState('locked');
    setMode(null);
  };

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <Lock size={26} className="text-primary" />
            </div>
            <h1 className="font-headline-lg text-2xl text-white font-bold mb-2">Admin area</h1>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
              Veyra has no user accounts, but the admin dashboard is still locked. Enter the admin
              key for this deployment.
            </p>
          </div>

          <form
            onSubmit={handleUnlock}
            className="p-5 rounded-2xl bg-surface-container border border-white/5 space-y-4"
          >
            <div className="relative">
              <KeyRound
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Admin key"
                autoComplete="off"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs leading-relaxed" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Unlock
            </button>

            <p className="text-on-surface-variant/70 text-[11px] leading-relaxed">
              The key is checked by the API against <code className="text-white/70">ADMIN_ACCESS_KEY</code>{' '}
              and kept for this browser tab only. Running Veyra without a backend? The in-browser demo
              accepts <code className="text-white/70">{DEMO_ADMIN_KEY}</code>.
            </p>
          </form>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-white text-sm mt-6"
          >
            <ArrowLeft size={15} /> Back to Veyra
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50">
        <ShieldCheck size={14} className="text-emerald-300" />
        <span className="text-on-surface-variant text-[11px]">
          Admin unlocked{mode === 'demo' ? ' (demo key)' : ''}
        </span>
        <button
          onClick={lock}
          className="text-[11px] text-white/70 hover:text-white underline underline-offset-2"
        >
          Lock
        </button>
      </div>
      {children}
    </>
  );
}
