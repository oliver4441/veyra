'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

type AuthMode = 'login' | 'register' | 'reset';

const googleProvider = new GoogleAuthProvider();

function friendlyFirebaseError(err: any): string | null {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project.';
    default:
      return err?.message || 'An unexpected error occurred.';
  }
}

export default function AuthPage() {
  const router = useRouter();
  const [returnTo] = useState(() => {
    if (typeof window === 'undefined') return '/';
    return new URLSearchParams(window.location.search).get('returnTo') || '/';
  });

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((fbUser) => {
      if (fbUser) router.replace(returnTo);
    });
    return () => unsub();
  }, [router, returnTo]);

  const applyPersistence = async () => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'reset') {
      if (!email) {
        setError('Enter your account email.');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setNotice('Password reset email sent. Check your inbox.');
      } catch (err: any) {
        setError(friendlyFirebaseError(err) || 'Could not send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      await applyPersistence();

      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        sendEmailVerification(cred.user).catch(() => {});
      }

      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) await api.exchangeFirebaseToken(token);
      } catch {
        // API down — auth state still works via Firebase
      }

      router.replace(returnTo);
    } catch (err: any) {
      setError(friendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithPopup(auth, googleProvider);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) await api.exchangeFirebaseToken(token);
      } catch {
        // API down
      }
      router.replace(returnTo);
    } catch (err: any) {
      const msg = friendlyFirebaseError(err);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Branding (hidden on mobile) ──────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface to-background" />

        {/* Decorative orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-tertiary/10 blur-[100px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 max-w-xl">
          <Link href="/" className="mb-12 inline-block">
            <span className="font-headline-md text-4xl font-bold tracking-tighter text-gradient">
              Veyra
            </span>
          </Link>

          <h1 className="font-headline-lg text-headline-lg text-white leading-tight mb-6">
            Build something{' '}
            <span className="text-gradient">extraordinary</span>
          </h1>

          <p className="text-body-lg text-on-surface-variant leading-relaxed mb-10">
            Your creative workspace for designing, shipping, and scaling products — powered by AI and built for speed.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            {[
              'Real-time collaboration with your team',
              'AI-powered workflows that adapt to you',
              'Ship from idea to production in minutes',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <ArrowRight size={12} className="text-primary" />
                </div>
                <span className="text-sm text-on-surface-variant">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="absolute bottom-8 left-16 xl:left-24 text-xs text-outline">
          © {new Date().getFullYear()} Veyra
        </div>
      </div>

      {/* ── Right Panel: Auth Form ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-block">
              <span className="font-headline-md text-3xl font-bold tracking-tighter text-gradient">
                Veyra
              </span>
            </Link>
          </div>

          {/* Mode Toggle */}
          {!isReset && (
            <div className="flex gap-2 p-1 bg-surface-container rounded-xl mb-6">
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'login'
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'text-on-surface-variant hover:text-white hover:bg-surface-container-high'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === 'register'
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'text-on-surface-variant hover:text-white hover:bg-surface-container-high'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h2 className="font-headline-md text-2xl font-bold text-white">
              {isReset
                ? 'Reset password'
                : isRegister
                  ? 'Create your account'
                  : 'Welcome back'}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {isReset
                ? "Enter your email and we'll send a reset link."
                : isRegister
                  ? 'Start building in seconds.'
                  : 'Sign in to access your workspace.'}
            </p>
          </div>

          {/* Google Button */}
          {!isReset && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/10 transition-all duration-200 disabled:opacity-50 mb-4 group"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.1 36.1 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z" />
              </svg>
              <span className="text-sm font-medium text-on-surface group-hover:text-white transition-colors">
                Continue with Google
              </span>
            </button>
          )}

          {/* Divider */}
          {!isReset && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          {/* Error / Notice */}
          {error && (
            <div className="mb-4 p-3.5 bg-error-container/20 border border-error/30 rounded-xl text-error text-sm animate-slide-in">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm flex items-start gap-2 animate-slide-in">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              {notice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="input-field pl-12"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="input-field pl-12"
                required
              />
            </div>

            {!isReset && (
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Password (min 8 characters)' : 'Password'}
                  className="input-field pl-12 pr-12"
                  required
                  minLength={isRegister ? 8 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {isRegister && (
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="input-field pl-12"
                  required
                />
              </div>
            )}

            {/* Remember me */}
            {mode === 'login' && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isReset ? (
                'Send Reset Email'
              ) : isRegister ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-on-surface-variant">
            {isReset ? (
              <p>
                Remembered it?{' '}
                <button onClick={() => switchMode('login')} className="text-primary hover:underline font-medium">
                  Back to sign in
                </button>
              </p>
            ) : isRegister ? (
              <p>
                Already have an account?{' '}
                <button onClick={() => switchMode('login')} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                New to Veyra?{' '}
                <button onClick={() => switchMode('register')} className="text-primary hover:underline font-medium">
                  Create an account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
