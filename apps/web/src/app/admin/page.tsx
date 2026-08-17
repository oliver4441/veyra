'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  Film, Users, HardDrive, Activity, BarChart3,
  Settings, Upload, Clock, Star, TrendingUp, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface DashboardStats {
  totalMovies: number;
  publishedMovies: number;
  totalUsers: number;
  totalViews: number;
  totalWatchTimeHours: number;
  storageUsed: number;
  storageLimit: number;
  activeJobs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.request<{ stats: DashboardStats }>('/api/admin/dashboard');
        setStats(res.stats);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const statCards = stats
    ? [
        { label: 'Total Titles', value: stats.totalMovies, icon: Film, color: 'text-primary' },
        { label: 'Published', value: stats.publishedMovies, icon: TrendingUp, color: 'text-green-400' },
        { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
        { label: 'Total Views', value: stats.totalViews.toLocaleString(), icon: BarChart3, color: 'text-yellow-400' },
        { label: 'Watch Time', value: `${stats.totalWatchTimeHours}h`, icon: Clock, color: 'text-purple-400' },
        { label: 'Storage Used', value: formatBytes(stats.storageUsed), icon: HardDrive, color: 'text-orange-400' },
      ]
    : [];

  const quickLinks = [
    { label: 'TMDB Import', description: 'Search and import movie metadata', href: '/admin/movies', icon: Upload },
    { label: 'Local Catalog', description: 'Manage your movie catalog', href: '/admin/movies', icon: Film },
    { label: 'Storage Manager', description: 'Monitor and configure storage', href: '/admin/storage', icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-5 md:px-16 pt-24 pb-32">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline-md text-3xl md:text-4xl text-white">Admin Dashboard</h1>
          <p className="text-on-surface-variant mt-1">Overview of your Veyra platform</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm mb-8">
            {error}
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="p-4 bg-surface-container rounded-xl border border-white/5"
                  >
                    <Icon size={20} className={`${stat.color} mb-2`} />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Quick Links */}
            <div className="mb-10">
              <h2 className="font-headline-md text-xl text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="group p-5 bg-surface-container rounded-xl border border-white/5 hover:border-primary/30 hover:bg-surface-container-high transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Icon size={20} className="text-primary" />
                        </div>
                        <h3 className="text-white font-semibold group-hover:text-primary transition-colors">
                          {link.label}
                        </h3>
                      </div>
                      <p className="text-on-surface-variant text-sm">{link.description}</p>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Storage Warning */}
            {stats && stats.storageUsed / stats.storageLimit > 0.8 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm mb-8">
                ⚠ Storage is at {Math.round((stats.storageUsed / stats.storageLimit) * 100)}% capacity.
                Consider adding another provider or freeing up space.
              </div>
            )}

            {/* Active Jobs */}
            {stats && stats.activeJobs > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm">
                <div className="flex items-center gap-2">
                  <Activity size={16} />
                  <span>{stats.activeJobs} active processing job{stats.activeJobs !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
