// Frontend Storage Service
// Handles communication with the storage API

import { api } from './api';

export type StorageProviderType =
  | 'cloudflare-r2'
  | 'terabox'
  | 'google-drive'
  | 'backblaze-b2'
  | 'dropbox'
  | 'mega'
  | 's3-compatible';

export type StoragePurpose =
  | 'primary-media'
  | 'archive'
  | 'posters-artwork'
  | 'subtitles'
  | 'trailers'
  | 'backups'
  | 'hot-storage'
  | 'cold-storage'
  | 'general';

export type StorageHealthStatus =
  | 'connected'
  | 'disconnected'
  | 'auth-expired'
  | 'error'
  | 'rate-limited'
  | 'storage-full'
  | 'unavailable';

export interface ProviderMetadata {
  type: StorageProviderType;
  name: string;
  description: string;
  authType: 'oauth' | 'credentials' | 'built-in';
  capabilities: {
    upload: boolean;
    download: boolean;
    streaming: boolean;
    directLinks: boolean;
    thumbnails: boolean;
    delete: boolean;
    folders: boolean;
    multipartUpload: boolean;
  };
  logoUrl?: string;
  websiteUrl?: string;
  setupUrl?: string;
  connected?: boolean;
}

export interface StorageAccount {
  id: string;
  providerType: StorageProviderType;
  displayName: string;
  status: StorageHealthStatus;
  purpose: StoragePurpose;
  priority: number;
  isDefault: boolean;
  quotaTotal: number | null;
  quotaUsed: number | null;
  lastHealthCheck: string | null;
  capabilities: Record<string, boolean> | null;
}

export interface StorageQuota {
  r2: {
    used: number;
    available: number;
    total: number;
    percentage: number;
    usedFormatted: string;
    availableFormatted: string;
    totalFormatted: string;
  };
  files: {
    count: number;
    totalSize: number;
  };
}

export interface StorageHealth {
  status: StorageHealthStatus;
  message?: string;
  lastChecked: string;
  latencyMs?: number;
}

class StorageService {
  // Get all providers and accounts
  async getProviders(): Promise<{
    providers: ProviderMetadata[];
    accounts: StorageAccount[];
  }> {
    // Use the API client for authenticated requests
    const response = await api.request<{
      providers: ProviderMetadata[];
      accounts: StorageAccount[];
    }>('/api/storage/providers');
    return response;
  }

  // Get connected accounts
  async getAccounts(): Promise<StorageAccount[]> {
    const response = await api.request<{
      accounts: StorageAccount[];
    }>('/api/storage/accounts');
    return response.accounts;
  }

  // Create a new storage account
  async createAccount(data: {
    providerType: StorageProviderType;
    displayName: string;
    purpose?: StoragePurpose;
    priority?: number;
    credentials?: Record<string, unknown>;
  }): Promise<StorageAccount> {
    const response = await api.request<{
      account: StorageAccount;
    }>('/api/storage/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.account;
  }

  // Update a storage account
  async updateAccount(
    id: string,
    data: {
      displayName?: string;
      purpose?: StoragePurpose;
      priority?: number;
    }
  ): Promise<StorageAccount> {
    const response = await api.request<{
      account: StorageAccount;
    }>(`/api/storage/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.account;
  }

  // Delete/disconnect a storage account
  async deleteAccount(id: string): Promise<void> {
    await api.request(`/api/storage/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  // Test connection
  async testConnection(id: string): Promise<StorageHealth> {
    const response = await api.request<{
      health: StorageHealth;
    }>(`/api/storage/accounts/${id}/test`, {
      method: 'POST',
    });
    return response.health;
  }

  // Get storage quota
  async getQuota(): Promise<StorageQuota> {
    const response = await api.request<StorageQuota>('/api/storage/quota');
    return response;
  }

  // Upload a file
  async uploadFile(
    type: 'movie' | 'episode' | 'image',
    file: File,
    metadata: Record<string, string>
  ): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const endpoint = type === 'image' ? 'upload/image' : `upload/${type}`;

    const response = await api.request<{ url: string; key: string }>(
      `/api/storage/${endpoint}`,
      {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      }
    );
    return response;
  }
}

export const storageService = new StorageService();
