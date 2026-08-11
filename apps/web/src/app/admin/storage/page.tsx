'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  HardDrive,
  Cloud,
  FolderOpen,
  Plus,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  storageService,
  type ProviderMetadata,
  type StorageAccount,
  type StorageQuota,
  type StorageHealthStatus,
} from '@/lib/storage';

// Mock data for initial render
const MOCK_PROVIDERS: ProviderMetadata[] = [
  {
    type: 'cloudflare-r2',
    name: 'Cloudflare R2',
    description: 'Fast, S3-compatible object storage with zero egress fees.',
    authType: 'built-in',
    capabilities: {
      upload: true,
      download: true,
      streaming: true,
      directLinks: true,
      thumbnails: true,
      delete: true,
      folders: true,
      multipartUpload: true,
    },
    connected: true,
  },
  {
    type: 'terabox',
    name: 'TeraBox',
    description: 'Large media storage with M3U8 streaming support.',
    authType: 'oauth',
    capabilities: {
      upload: true,
      download: true,
      streaming: true,
      directLinks: false,
      thumbnails: false,
      delete: true,
      folders: true,
      multipartUpload: true,
    },
  },
  {
    type: 'google-drive',
    name: 'Google Drive',
    description: 'Archive and asset storage with OAuth integration.',
    authType: 'oauth',
    capabilities: {
      upload: true,
      download: true,
      streaming: false,
      directLinks: true,
      thumbnails: true,
      delete: true,
      folders: true,
      multipartUpload: true,
    },
  },
  {
    type: 'backblaze-b2',
    name: 'Backblaze B2',
    description: 'S3-compatible object storage for backups and archives.',
    authType: 'credentials',
    capabilities: {
      upload: true,
      download: true,
      streaming: true,
      directLinks: true,
      thumbnails: true,
      delete: true,
      folders: false,
      multipartUpload: true,
    },
  },
  {
    type: 'dropbox',
    name: 'Dropbox',
    description: 'Cloud storage with OAuth integration.',
    authType: 'oauth',
    capabilities: {
      upload: true,
      download: true,
      streaming: false,
      directLinks: true,
      thumbnails: true,
      delete: true,
      folders: true,
      multipartUpload: true,
    },
  },
];

const MOCK_ACCOUNTS: StorageAccount[] = [
  {
    id: 'r2-default',
    providerType: 'cloudflare-r2',
    displayName: 'Cloudflare R2',
    status: 'connected',
    purpose: 'primary-media',
    priority: 10,
    isDefault: true,
    quotaTotal: 10 * 1024 * 1024 * 1024,
    quotaUsed: 8.4 * 1024 * 1024 * 1024,
    lastHealthCheck: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    capabilities: null,
  },
];

const MOCK_QUOTA: StorageQuota = {
  r2: {
    used: 8.4 * 1024 * 1024 * 1024,
    available: 1.6 * 1024 * 1024 * 1024,
    total: 10 * 1024 * 1024 * 1024,
    percentage: 84,
    usedFormatted: '8.4 GB',
    availableFormatted: '1.6 GB',
    totalFormatted: '10 GB',
  },
  files: {
    count: 24,
    totalSize: 8.4 * 1024 * 1024 * 1024,
  },
};

export default function AdminStoragePage() {
  const [providers, setProviders] = useState<ProviderMetadata[]>(MOCK_PROVIDERS);
  const [accounts, setAccounts] = useState<StorageAccount[]>(MOCK_ACCOUNTS);
  const [quota, setQuota] = useState<StorageQuota>(MOCK_QUOTA);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [showAddProvider, setShowAddProvider] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [providersData, accountsData, quotaData] = await Promise.allSettled([
        storageService.getProviders(),
        storageService.getAccounts(),
        storageService.getQuota(),
      ]);

      if (providersData.status === 'fulfilled') {
        setProviders(providersData.value.providers);
        setAccounts(providersData.value.accounts);
      }
      if (accountsData.status === 'fulfilled') {
        setAccounts(accountsData.value);
      }
      if (quotaData.status === 'fulfilled') {
        setQuota(quotaData.value);
      }
    } catch {
      // Use mock data
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (accountId: string) => {
    setTestingConnection(accountId);
    try {
      await storageService.testConnection(accountId);
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this storage provider?')) {
      return;
    }

    try {
      await storageService.deleteAccount(accountId);
      await fetchData();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const getStatusIcon = (status: StorageHealthStatus) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      case 'auth-expired':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: StorageHealthStatus) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'disconnected':
        return 'text-gray-500';
      case 'auth-expired':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-primary';
  };

  const formatPurpose = (purpose: string) => {
    return purpose.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const defaultAccount = accounts.find((a) => a.isDefault);
  const optionalAccounts = accounts.filter((a) => !a.isDefault);
  const unconnectedProviders = providers.filter(
    (p) => !accounts.some((a) => a.providerType === p.type && a.status === 'connected')
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-5 md:px-16 max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-headline-md text-3xl text-white">Storage Manager</h1>
            <p className="text-on-surface-variant mt-1">
              Manage storage providers and monitor usage
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Default Storage Section */}
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Default Storage</h2>
              
              {defaultAccount ? (
                <div className="glass-panel rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Cloud className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{defaultAccount.displayName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(defaultAccount.status)}
                          <span className={`text-sm ${getStatusColor(defaultAccount.status)}`}>
                            {defaultAccount.status === 'connected' ? 'Active' : defaultAccount.status}
                          </span>
                          <span className="text-xs text-on-surface-variant">•</span>
                          <span className="text-xs text-on-surface-variant">
                            {formatPurpose(defaultAccount.purpose)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">
                      ★ Default
                    </span>
                  </div>

                  {/* Usage Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-on-surface-variant">
                        Used: {quota.r2.usedFormatted}
                      </span>
                      <span className="text-on-surface-variant">
                        Available: {quota.r2.availableFormatted}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getUsageColor(quota.r2.percentage)}`}
                        style={{ width: `${Math.min(100, quota.r2.percentage)}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-on-surface-variant mt-1">
                      {quota.r2.totalFormatted} total
                    </div>
                  </div>

                  {/* Warning */}
                  {quota.r2.percentage >= 80 && (
                    <div className={`p-3 rounded-lg mb-4 ${
                      quota.r2.percentage >= 95
                        ? 'bg-red-500/10 border border-red-500/30'
                        : 'bg-yellow-500/10 border border-yellow-500/30'
                    }`}>
                      <p className={`text-sm ${
                        quota.r2.percentage >= 95 ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        ⚠ Storage is approaching capacity. Consider adding another provider or freeing up space.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleTestConnection(defaultAccount.id)}
                      disabled={testingConnection === defaultAccount.id}
                      className="btn-glass flex items-center gap-2 text-sm"
                    >
                      {testingConnection === defaultAccount.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Test Connection
                    </button>
                    <button className="btn-glass flex items-center gap-2 text-sm">
                      <Settings className="w-4 h-4" />
                      Manage
                    </button>
                  </div>

                  {/* Last Health Check */}
                  {defaultAccount.lastHealthCheck && (
                    <p className="text-xs text-on-surface-variant mt-4">
                      Last health check: {new Date(defaultAccount.lastHealthCheck).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="glass-panel rounded-xl p-6 text-center">
                  <Cloud className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
                  <p className="text-on-surface-variant">No default storage configured</p>
                </div>
              )}
            </section>

            {/* Optional Storage Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline-md text-xl text-white">Optional Storage</h2>
                <button
                  onClick={() => setShowAddProvider(true)}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Storage Provider
                </button>
              </div>

              {/* Connected Optional Providers */}
              {optionalAccounts.length > 0 && (
                <div className="grid gap-4 mb-4">
                  {optionalAccounts.map((account) => {
                    const provider = providers.find((p) => p.type === account.providerType);
                    return (
                      <div key={account.id} className="glass-panel rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
                              <FolderOpen className="w-5 h-5 text-on-surface-variant" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{account.displayName}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusIcon(account.status)}
                                <span className={`text-sm ${getStatusColor(account.status)}`}>
                                  {account.status}
                                </span>
                                <span className="text-xs text-on-surface-variant">•</span>
                                <span className="text-xs text-on-surface-variant">
                                  Priority: {account.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTestConnection(account.id)}
                              disabled={testingConnection === account.id}
                              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                              {testingConnection === account.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDisconnect(account.id)}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available Providers */}
              <div className="grid gap-4 md:grid-cols-2">
                {unconnectedProviders.map((provider) => (
                  <div key={provider.type} className="glass-panel rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
                          <Cloud className="w-5 h-5 text-on-surface-variant" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{provider.name}</h3>
                          <p className="text-sm text-on-surface-variant mt-1">
                            {provider.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="btn-primary flex items-center gap-2 text-sm">
                        <Plus className="w-4 h-4" />
                        Connect
                      </button>
                      {provider.websiteUrl && (
                        <a
                          href={provider.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-glass flex items-center gap-2 text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Storage Statistics */}
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Statistics</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-panel rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive className="w-5 h-5 text-primary" />
                    <span className="text-on-surface-variant text-sm">Total Files</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{quota.files.count}</p>
                </div>
                <div className="glass-panel rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Cloud className="w-5 h-5 text-primary" />
                    <span className="text-on-surface-variant text-sm">Total Storage</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{quota.r2.usedFormatted}</p>
                </div>
                <div className="glass-panel rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <span className="text-on-surface-variant text-sm">Connected Providers</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{accounts.length}</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Add Provider Modal */}
      {showAddProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddProvider(false)}
          />
          <div className="relative glass-panel rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="font-headline-md text-xl text-white mb-4">Select Storage Provider</h2>
            
            <div className="space-y-3">
              {unconnectedProviders.map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => {
                    // TODO: Open connection flow
                    setShowAddProvider(false);
                  }}
                  className="w-full p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{provider.name}</h3>
                      <p className="text-sm text-on-surface-variant">{provider.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                          {provider.authType === 'oauth' ? 'OAuth' : 'Credentials'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddProvider(false)}
              className="w-full mt-4 btn-glass"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
