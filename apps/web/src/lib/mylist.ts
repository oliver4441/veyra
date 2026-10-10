// ─────────────────────────────────────────────────────────────────────────────
// Guest library — "My List" and resume points, stored on the device
// ─────────────────────────────────────────────────────────────────────────────
// Veyra has no accounts, so the things an account used to hold (saved titles,
// where you stopped watching) live on the device instead. That is a feature: it
// works offline, needs no server, and nothing leaves the phone.
//
// Two kinds of thing are stored here:
//   • Source items — archive.org films and YouTube videos have string ids that
//     are not rows in Veyra's database, so they cannot use /api/watch/*.
//   • Catalogue items — mirrored locally too, so the app still resumes a film
//     when the API is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceProviderId } from './sources/types';

const LIST_KEY = 'veyra-my-list-v1';
const PROGRESS_KEY = 'veyra-progress-v1';
const MAX_PROGRESS_ENTRIES = 200;

export interface SavedItem {
  provider: SourceProviderId;
  id: string;
  title: string;
  posterUrl?: string;
  year?: number;
  kind: 'movie' | 'series';
  license?: string;
  sourceUrl?: string;
  addedAt: number;
}

export interface ProgressEntry {
  provider: SourceProviderId;
  id: string;
  episodeId?: string;
  title: string;
  posterUrl?: string;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeGuestStore(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    // Keep other tabs in sync.
    window.addEventListener('storage', listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', listener);
    };
  }
  return () => listeners.delete(listener);
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emit();
  } catch {
    // Storage full or blocked (private mode) — the app keeps working, it just
    // forgets between sessions.
  }
}

// ── My List ─────────────────────────────────────────────────────────────────

export function getMyList(): SavedItem[] {
  return read<SavedItem[]>(LIST_KEY, []).sort((a, b) => b.addedAt - a.addedAt);
}

export function isInMyList(provider: SourceProviderId, id: string): boolean {
  return getMyList().some((item) => item.provider === provider && item.id === id);
}

export function addToMyList(item: Omit<SavedItem, 'addedAt'>): void {
  const list = getMyList();
  if (list.some((i) => i.provider === item.provider && i.id === item.id)) return;
  write(LIST_KEY, [{ ...item, addedAt: Date.now() }, ...list]);
}

export function removeFromMyList(provider: SourceProviderId, id: string): void {
  write(
    LIST_KEY,
    getMyList().filter((i) => !(i.provider === provider && i.id === id))
  );
}

export function clearMyList(): void {
  write(LIST_KEY, []);
}

export function toggleMyList(item: Omit<SavedItem, 'addedAt'>): boolean {
  if (isInMyList(item.provider, item.id)) {
    removeFromMyList(item.provider, item.id);
    return false;
  }
  addToMyList(item);
  return true;
}

// ── Resume points ───────────────────────────────────────────────────────────

export function getAllProgress(): ProgressEntry[] {
  return read<ProgressEntry[]>(PROGRESS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProgressFor(provider: SourceProviderId, id: string): ProgressEntry | undefined {
  return getAllProgress().find((p) => p.provider === provider && p.id === id);
}

export function saveProgress(entry: Omit<ProgressEntry, 'updatedAt'>): void {
  const all = getAllProgress().filter(
    (p) => !(p.provider === entry.provider && p.id === entry.id && p.episodeId === entry.episodeId)
  );
  const next: ProgressEntry = { ...entry, updatedAt: Date.now() };
  // Treat >95% as finished so "Continue watching" does not fill up with endings.
  if (entry.duration > 0 && entry.position / entry.duration > 0.95) next.completed = true;
  write(PROGRESS_KEY, [next, ...all].slice(0, MAX_PROGRESS_ENTRIES));
}

export function clearProgress(provider: SourceProviderId, id: string): void {
  write(
    PROGRESS_KEY,
    getAllProgress().filter((p) => !(p.provider === provider && p.id === id))
  );
}

export function clearAllProgress(): void {
  write(PROGRESS_KEY, []);
}
