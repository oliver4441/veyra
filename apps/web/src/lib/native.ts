// ─────────────────────────────────────────────────────────────────────────────
// Native platform adapter (Capacitor)
// ─────────────────────────────────────────────────────────────────────────────
// Every capability the Android/iOS shell adds lives behind this module, and
// every function degrades to a working web behaviour when Capacitor is absent.
// That means the same Next.js bundle serves the website, the PWA and the APK.
//
// The important asymmetry this file exists to exploit:
//   • In a browser, archive.org's file nodes send no CORS headers, so fetch()
//     cannot read video bytes. An <a download> still works (no CORS involved).
//   • In the native shell, downloads happen through the platform's own HTTP
//     stack (Android DownloadManager / NSURLSession via @capacitor/file-transfer)
//     which ignores CORS entirely, reports byte-level progress, survives the
//     app being backgrounded, and writes straight into device storage.
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceProviderId } from './sources/types';

export type NativePlatform = 'web' | 'android' | 'ios';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  convertFileSrc?: (path: string, scheme?: string) => string;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

export function platform(): NativePlatform {
  const p = cap()?.getPlatform?.();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

/**
 * Turn an absolute device path into something a <video> element can load.
 * On the web this is a no-op passthrough.
 */
export async function fileSrc(path: string): Promise<string> {
  const injected = cap()?.convertFileSrc;
  if (injected) {
    try {
      return injected(path);
    } catch {
      // fall through to the package import
    }
  }
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.convertFileSrc(path);
  } catch {
    return path;
  }
}

// ── Storage locations ───────────────────────────────────────────────────────

export interface DownloadLocation {
  /** Capacitor Directory enum value. */
  directory: string;
  /** Folder inside that directory, e.g. "Movies/Veyra". */
  basePath: string;
  /** True when the location is visible to other apps / file managers. */
  public: boolean;
  label: string;
}

const ANDROID_PUBLIC: DownloadLocation = {
  directory: 'EXTERNAL_STORAGE',
  basePath: 'Movies/Veyra',
  public: true,
  label: 'Device storage → Movies/Veyra',
};

const APP_PRIVATE: DownloadLocation = {
  directory: 'DOCUMENTS',
  basePath: 'Veyra',
  public: false,
  label: 'Veyra app storage',
};

/**
 * Android 10+ scoped storage means only Android ≤9 can write to the shared
 * Movies/ folder without a permission dance, so we try it and fall back to
 * app-private storage — which always works and still plays offline in-app.
 * Files there can be exported on demand (see `shareFile`).
 */
export async function resolveLocation(): Promise<DownloadLocation> {
  if (!isNative()) return APP_PRIVATE;
  if (platform() !== 'android') return APP_PRIVATE;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const probe = `${ANDROID_PUBLIC.basePath}/.veyra-probe`;
    await Filesystem.writeFile({
      directory: Directory.ExternalStorage,
      path: probe,
      data: 'ok',
    });
    await Filesystem.deleteFile({ directory: Directory.ExternalStorage, path: probe });
    return ANDROID_PUBLIC;
  } catch {
    return APP_PRIVATE;
  }
}

/**
 * Resolve a Capacitor `Directory` enum member by name. Done by name rather than
 * by value so the code never depends on the numeric layout of the enum.
 */
async function directoryEnumFor(name: string) {
  const { Directory } = await import('@capacitor/filesystem');
  const table = Directory as unknown as Record<string, string>;
  return table[name] ?? Directory.Documents;
}

export async function ensureFolder(location: DownloadLocation, subPath: string) {
  if (!isNative()) return;
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    const directory = (await directoryEnumFor(location.directory)) as never;
    await Filesystem.mkdir({
      directory,
      path: joinPath(location.basePath, subPath),
      recursive: true,
    });
  } catch {
    // mkdir throws when the folder already exists — nothing to do.
  }
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .join('/');
}

/** Filesystem-safe folder name: "Night of the Living Dead" → "Night_of_the_Living_Dead". */
export function safeName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '_')
    .slice(0, 80) || 'untitled';
}

// ── Native download ─────────────────────────────────────────────────────────

export interface NativeDownloadRequest {
  url: string;
  location: DownloadLocation;
  relativePath: string; // e.g. "Movies/Veyra/Title/file.mp4"
  headers?: Record<string, string>;
}

export interface NativeDownloadResult {
  path: string;
  uri: string;
  /** Something a <video> element can play. */
  playable: string;
}

export type NativeProgressHandler = (event: {
  bytes: number;
  contentLength: number;
  url: string;
  lengthComputable?: boolean;
}) => void;

let progressListenerAttached = false;
const progressHandlers = new Set<NativeProgressHandler>();

async function attachProgressListener() {
  if (progressListenerAttached || !isNative()) return;
  try {
    const { FileTransfer } = await import('@capacitor/file-transfer');
    await FileTransfer.addListener('progress', (event) => {
      if (event.type !== 'download') return;
      progressHandlers.forEach((handler) => handler(event));
    });
    progressListenerAttached = true;
  } catch {
    // Without progress events downloads still complete; the UI shows a spinner.
  }
}

export function onNativeProgress(handler: NativeProgressHandler): () => void {
  progressHandlers.add(handler);
  void attachProgressListener();
  return () => progressHandlers.delete(handler);
}

/**
 * Download one file with the platform's native HTTP stack.
 * Only ever called from the APK — the web path uses an anchor download.
 */
export async function nativeDownload(req: NativeDownloadRequest): Promise<NativeDownloadResult> {
  const { Filesystem } = await import('@capacitor/filesystem');
  const { FileTransfer } = await import('@capacitor/file-transfer');
  const directory = (await directoryEnumFor(req.location.directory)) as never;

  const folder = req.relativePath.slice(0, Math.max(0, req.relativePath.lastIndexOf('/')));
  if (folder) {
    await Filesystem.mkdir({ directory, path: folder, recursive: true }).catch(() => undefined);
  }

  const info = await Filesystem.getUri({ directory, path: req.relativePath });
  await FileTransfer.downloadFile({
    url: req.url,
    path: info.uri,
    progress: true,
    headers: req.headers,
  });

  return {
    path: req.relativePath,
    uri: info.uri,
    playable: await fileSrc(info.uri),
  };
}

/** Rough free-space estimate. Best-effort — used only for friendly warnings. */
export async function estimateFreeBytes(): Promise<number | undefined> {
  try {
    if (navigator.storage?.estimate) {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota && usage !== undefined) return Math.max(0, quota - usage);
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** Hand a finished file to the OS share sheet so the user can export it. */
export async function shareFile(uri: string, title: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Share } = await import('@capacitor/share');
    const canShare = await Share.canShare();
    if (!canShare.value) return false;
    await Share.share({
      title,
      url: uri,
      dialogTitle: `Export ${title}`,
      files: [uri],
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(location: DownloadLocation, relativePath: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    const directory = (await directoryEnumFor(location.directory)) as never;
    await Filesystem.deleteFile({ directory, path: relativePath });
    return true;
  } catch {
    return false;
  }
}

// ── Provider metadata for storage paths ─────────────────────────────────────

export function providerFolder(provider: SourceProviderId): string {
  switch (provider) {
    case 'archive':
      return 'Archive';
    case 'youtube':
      return 'YouTube';
    case 'external':
      return 'External';
    default:
      return 'Veyra';
  }
}
