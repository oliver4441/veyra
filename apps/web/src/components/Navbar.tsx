'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bookmark,
  Download,
  Menu,
  Search,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useDownloads, useDownloadSubscription } from '@/lib/downloads/use-downloads';
import { getMyList, subscribeGuestStore } from '@/lib/mylist';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/search', label: 'Search' },
  { href: '/downloads', label: 'Downloads' },
  { href: '/watchlist', label: 'My List' },
];

/**
 * Global navigation.
 *
 * Veyra has no accounts, so there is no sign-in button and no user menu. The
 * right-hand side is purely functional: search, the download queue (with a live
 * badge) and the on-device list. Admin is still reachable, but it is gated by a
 * server-side key on the admin pages themselves — never from this bar.
 */
export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const jobs = useDownloadSubscription();
  const manager = useDownloads();
  const activeDownloads = useMemo(
    () =>
      jobs.reduce(
        (sum, job) =>
          sum + job.items.filter((i) => i.state === 'downloading' || i.state === 'queued').length,
        0
      ),
    [jobs]
  );

  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    const sync = () => setSavedCount(getMyList().length);
    sync();
    return subscribeGuestStore(sync);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20'
          : 'bg-gradient-to-b from-background/80 via-background/40 to-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 md:px-16">
        <div className="flex justify-between items-center h-16 md:h-[72px]">
          {/* Left */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-headline-md text-2xl font-bold tracking-tighter text-primary hover:text-primary/90 transition-colors"
            >
              Veyra
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                    isActive(link.href) ? 'text-white' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  {link.label}
                  {link.href === '/downloads' && activeDownloads > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-bold align-middle">
                      {activeDownloads}
                    </span>
                  )}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link
              href="/search"
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>

            <Link
              href="/downloads"
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              aria-label="Downloads"
            >
              <Download size={18} />
              {activeDownloads > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[9px] font-bold flex items-center justify-center">
                  {activeDownloads}
                </span>
              )}
            </Link>

            <Link
              href="/watchlist"
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              aria-label="My List"
            >
              <Bookmark size={18} />
              {savedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-white/15 text-white text-[9px] font-bold flex items-center justify-center">
                  {savedCount}
                </span>
              )}
            </Link>

            {/* Settings menu */}
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
                aria-label="Settings"
                aria-expanded={menuOpen}
              >
                <Settings size={18} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 glass-panel rounded-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-white text-sm font-semibold">Guest on this device</p>
                    <p className="text-on-surface-variant text-[11px] mt-0.5 leading-snug">
                      No account needed. Your list, resume points and downloads stay on this device.
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={15} /> Preferences
                  </Link>
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Shield size={15} /> Admin (key required)
                  </Link>
                  {activeDownloads > 0 && (
                    <button
                      onClick={() => {
                        void manager.archiveCompleted();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors border-t border-white/5"
                    >
                      <Download size={15} /> Clear finished downloads
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-t border-white/5 animate-slide-up">
          <div className="flex flex-col py-4 px-6 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                  isActive(link.href)
                    ? 'text-white bg-white/5'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
                {link.href === '/downloads' && activeDownloads > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-bold">
                    {activeDownloads}
                  </span>
                )}
              </Link>
            ))}
            <div className="h-px bg-white/5 my-2" />
            <Link
              href="/profile"
              className="py-2.5 px-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
            >
              Preferences
            </Link>
            <Link
              href="/admin"
              className="py-2.5 px-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
            >
              Admin
            </Link>
            <p className="px-3 pt-3 text-[11px] text-on-surface-variant/70 leading-snug">
              Veyra has no accounts — everything you save stays on this device.
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}
