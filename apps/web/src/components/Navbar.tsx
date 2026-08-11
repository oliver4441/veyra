'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Bell, Bookmark, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-surface/70 border-b border-white/10 backdrop-blur-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 md:px-16 py-4 flex justify-between items-center">
        {/* Logo & Desktop Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="font-headline-md text-2xl font-bold tracking-tighter text-primary">
            Veyra
          </Link>
          <div className="hidden md:flex gap-6">
            <Link
              href="/"
              className="font-label-caps text-xs text-primary font-bold border-b-2 border-primary pb-1 opacity-80 transition-all hover:opacity-100"
            >
              Home
            </Link>
            <Link
              href="/?type=movie"
              className="font-label-caps text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Movies
            </Link>
            <Link
              href="/?type=series"
              className="font-label-caps text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Series
            </Link>
            <Link
              href="/search"
              className="font-label-caps text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Search
            </Link>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <Search size={20} />
          </Link>
          <button
            aria-label="Bookmarks"
            className="text-on-surface-variant hover:text-on-surface transition-colors hidden md:block"
          >
            <Bookmark size={20} />
          </button>
          <button
            aria-label="Notifications"
            className="text-on-surface-variant hover:text-on-surface transition-colors hidden md:block"
          >
            <Bell size={20} />
          </button>
          <Link
            href="/auth"
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-on-surface-variant"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-t border-white/10 animate-slide-up">
          <div className="flex flex-col py-4 px-6 gap-4">
            <Link
              href="/"
              className="font-label-caps text-xs text-primary"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/?type=movie"
              className="font-label-caps text-xs text-on-surface-variant"
              onClick={() => setMobileMenuOpen(false)}
            >
              Movies
            </Link>
            <Link
              href="/?type=series"
              className="font-label-caps text-xs text-on-surface-variant"
              onClick={() => setMobileMenuOpen(false)}
            >
              Series
            </Link>
            <Link
              href="/search"
              className="font-label-caps text-xs text-on-surface-variant"
              onClick={() => setMobileMenuOpen(false)}
            >
              Search
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
