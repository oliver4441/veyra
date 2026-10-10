'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /profile — Preferences (there are no accounts, so nothing to sign into)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Eraser,
  Globe,
  HardDrive,
  Info,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getProfile, resetDeviceData, setDisplayName } from '@/lib/guest';
import {
  clearAllProgress,
  clearMyList,
  getAllProgress,
  getMyList,
  subscribeGuestStore,
} from '@/lib/mylist';
import { getSources } from '@/lib/sources/registry';
import { defaultRegion, setRegion } from '@/lib/sources/external';
import { useDownloads, formatBytes } from '@/lib/downloads/use-downloads';
import { estimateFreeBytes, isNative } from '@/lib/native';

const REGIONS: Array<{ code: string; label: string }> = [
  { code: 'KE', label: 'Kenya' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'IN', label: 'India' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'BR', label: 'Brazil' },
  { code: 'AE', label: 'United Arab Emirates' },
];

export default function PreferencesPage() {
  const manager = useDownloads();
  const [name, setName] = useState('Guest');
  const [savedName, setSavedName] = useState('Guest');
  const [region, setRegionState] = useState('US');
  const [deviceId, setDeviceId] = useState('');
  const [counts, setCounts] = useState({ list: 0, progress: 0 });
  const [native, setNative] = useState(false);
  const [freeBytes, setFreeBytes] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const sources = useMemo(() => getSources(), []);
  const stats = manager.stats();
  const location = manager.storageLocation;

  useEffect(() => {
    const profile = getProfile();
    setName(profile.displayName);
    setSavedName(profile.displayName);
    setDeviceId(profile.deviceId);
    setRegionState(defaultRegion());
    setNative(isNative());
    void manager.init();
    void estimateFreeBytes().then(setFreeBytes);
  }, [manager]);

  useEffect(() => {
    const sync = () => setCounts({ list: getMyList().length, progress: getAllProgress().length });
    sync();
    return subscribeGuestStore(sync);
  }, []);

  const handleSaveName = () => {
    const profile = setDisplayName(name);
    setSavedName(profile.displayName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRegion = (code: string) => {
    setRegion(code);
    setRegionState(code);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[900px] mx-auto">
        <div className="mb-8">
          <h1 className="font-headline-lg text-2xl md:text-4xl text-white font-bold mb-2">
            Preferences
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Veyra has no accounts and collects nothing. These settings live on this device only.
          </p>
        </div>

        <div className="space-y-6">
          {/* Identity */}
          <Card
            icon={<Info size={16} />}
            title="Your name on this device"
            description="Used only for the label on your reviews and lists. Never sent anywhere."
          >
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Guest"
                className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSaveName}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90"
              >
                {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="text-on-surface-variant/70 text-[11px] mt-3 font-mono truncate">
              device id: {deviceId || '—'}
            </p>
          </Card>

          {/* Region */}
          <Card
            icon={<Globe size={16} />}
            title="Streaming availability region"
            description="Decides which free services (Tubi, Pluto, Plex, Kanopy…) Veyra links you to. Most ad-supported catalogues are region-locked by the platforms themselves."
          >
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.code}
                  onClick={() => handleRegion(r.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    region === r.code
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-white/5 text-on-surface-variant border-white/10 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Sources */}
          <Card
            icon={<ShieldCheck size={16} />}
            title="Sources"
            description="What Veyra can play, and what it is allowed to save."
          >
            <div className="space-y-3">
              {sources.map((source) => {
                const enabled = source.available();
                return (
                  <div
                    key={source.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-white/5"
                  >
                    <span
                      className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        enabled ? 'bg-emerald-400' : 'bg-white/20'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white text-sm font-semibold">{source.name}</p>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-white/5 text-on-surface-variant border-white/10">
                          {source.capabilities.download === 'allowed' ? 'Stream + download' : 'Stream only'}
                        </span>
                        {!enabled && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-yellow-500/10 text-yellow-300 border-yellow-400/20">
                            Needs a key
                          </span>
                        )}
                      </div>
                      <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">
                        {source.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Downloads */}
          <Card
            icon={<Download size={16} />}
            title="Downloads"
            description={
              native
                ? 'Files are written to this device and play with no connection at all.'
                : 'On the web your browser handles the transfer and saves to its own Downloads folder. The Veyra app downloads inside the app instead.'
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric label="Queued" value={String(stats.active + stats.queued)} />
              <Metric label="Saved" value={String(stats.completed)} />
              <Metric label="On device" value={formatBytes(stats.bytes)} />
              <Metric label="Free space" value={freeBytes ? formatBytes(freeBytes) : 'Unknown'} />
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              {native ? <Smartphone size={14} /> : <HardDrive size={14} />}
              {native
                ? `Saving to: ${location?.label || 'device storage'}`
                : 'Saving to: your browser’s Downloads folder'}
            </div>
            <Link
              href="/downloads"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10"
            >
              Open downloads
            </Link>
          </Card>

          {/* Data */}
          <Card
            icon={<Eraser size={16} />}
            title="On-device data"
            description="Everything Veyra stores, and how to clear it."
          >
            <div className="space-y-2">
              <DataRow
                label="My List"
                value={`${counts.list} title${counts.list === 1 ? '' : 's'}`}
                action={
                  <button
                    onClick={clearMyList}
                    className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                }
              />
              <DataRow
                label="Resume points"
                value={`${counts.progress} entr${counts.progress === 1 ? 'y' : 'ies'}`}
                action={
                  <button
                    onClick={clearAllProgress}
                    className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                }
              />
              <DataRow
                label="Downloaded files"
                value={`${stats.completed} file${stats.completed === 1 ? '' : 's'}`}
                action={
                  <Link
                    href="/downloads"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1.5"
                  >
                    Manage
                  </Link>
                }
              />
              <DataRow
                label="Everything"
                value="Name, list, resume points, device id"
                action={
                  <button
                    onClick={() => {
                      resetDeviceData();
                      window.location.reload();
                    }}
                    className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Reset
                  </button>
                }
              />
            </div>
          </Card>

          {/* Legal */}
          <Card
            icon={<ShieldCheck size={16} />}
            title="Where the content comes from"
          >
            <ul className="space-y-2 text-on-surface-variant text-xs leading-relaxed">
              <li>
                <strong className="text-white">Metadata</strong> — The Movie Database (TMDB). Veyra
                does not host posters or descriptions.
              </li>
              <li>
                <strong className="text-white">Films</strong> — the Internet Archive. Veyra streams
                from, and only saves copies of, items whose licence permits it (public domain or
                Creative Commons).
              </li>
              <li>
                <strong className="text-white">YouTube</strong> — played through YouTube&apos;s own
                embed player. YouTube&apos;s terms do not allow downloading, so Veyra does not offer
                it.
              </li>
              <li>
                <strong className="text-white">Other platforms</strong> — Tubi, Pluto TV, Plex,
                Crackle and Kanopy are linked to, never embedded or recorded.
              </li>
            </ul>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 rounded-2xl bg-surface-container border border-white/5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-white font-bold text-sm md:text-base">{title}</h2>
          {description && (
            <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-background/60 border border-white/5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant mb-1">
        {label}
      </p>
      <p className="text-white text-sm font-bold truncate">{value}</p>
    </div>
  );
}

function DataRow({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-background/60 border border-white/5">
      <div className="min-w-0">
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-on-surface-variant text-[11px] truncate">{value}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
