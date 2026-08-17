'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Bookmark, Menu, X, User, ChevronDown, LogOut, Settings } from 'lucide-react';
import { useUser } from '@/lib/use-user';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/?type=movie', label: 'Movies' },
  { href: '/?type=series', label: 'Series' },
  { href: '/browse', label: 'Browse' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  const initials = user?.displayName
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || user?.username?.slice(0, 2).toUpperCase() || 'U';

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
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-headline-md text-2xl font-bold tracking-tighter text-primary hover:text-primary/90 transition-colors"
            >
              Veyra
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                    isActive(link.href)
                      ? 'text-white'
                      : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  {link.label}
                  {/* Active indicator dot */}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </Link>
              ))}
              <Link
                href="/search"
                className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                  pathname === '/search'
                    ? 'text-white'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Search
                {pathname === '/search' && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </Link>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search icon (mobile) */}
            <Link
              href="/search"
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>

            {/* Watchlist */}
            <Link
              href="/watchlist"
              aria-label="My List"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all hidden md:flex"
            >
              <Bookmark size={18} />
            </Link>

            {/* Notifications */}
            <button
              aria-label="Notifications"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all hidden md:flex"
            >
              <Bell size={18} />
            </button>

            {/* User menu / Sign In */}
            {!loading && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full hover:bg-white/10 transition-all py-1 px-1"
                  aria-label="Account menu"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary/50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                      {initials}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-on-surface-variant transition-transform duration-200 hidden sm:block ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 glass-panel border border-white/10 rounded-xl py-1.5 animate-slide-up shadow-2xl shadow-black/40">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-sm font-semibold text-white truncate">
                        {user.displayName || user.username}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Settings size={15} className="opacity-60" />
                        Profile
                      </Link>
                      <Link
                        href="/watchlist"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Bookmark size={15} className="opacity-60" />
                        My List
                      </Link>
                    </div>

                    {/* Sign out */}
                    <div className="border-t border-white/5 pt-1.5">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <Link
                  href="/auth"
                  className="bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
                >
                  Sign In
                </Link>
              )
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-white bg-white/5'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/search"
              className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/search'
                  ? 'text-white bg-white/5'
                  : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Search
            </Link>

            {user ? (
              <>
                <div className="h-px bg-white/5 my-2" />
                <Link
                  href="/profile"
                  className="py-2.5 px-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOut();
                    router.push('/');
                  }}
                  className="py-2.5 px-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors text-left"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="py-2.5 px-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
