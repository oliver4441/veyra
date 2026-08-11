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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/providers`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch providers');
    }

    return response.json();
  }

  // Get connected accounts
  async getAccounts(): Promise<StorageAccount[]> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/accounts`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const data = await response.json();
    return data.accounts;
  }

  // Create a new storage account
  async createAccount(data: {
    providerType: StorageProviderType;
    displayName: string;
    purpose?: StoragePurpose;
    priority?: number;
    credentials?: Record<string, unknown>;
  }): Promise<StorageAccount> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/accounts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getToken()}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create account');
    }

    const result = await response.json();
    return result.account;
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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/accounts/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getToken()}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update account');
    }

    const result = await response.json();
    return result.account;
  }

  // Delete/disconnect a storage account
  async deleteAccount(id: string): Promise<void> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/accounts/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete account');
    }
  }

  // Test connection
  async testConnection(id: string): Promise<StorageHealth> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/accounts/${id}/test`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to test connection');
    }

    const data = await response.json();
    return data.health;
  }

  // Get storage quota
  async getQuota(): Promise<StorageQuota> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/quota`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch quota');
    }

    return response.json();
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

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/storage/${endpoint}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  // Helper to get auth token
  private getToken(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('veyra_access_token') || '';
    }
    return '';
  }
}

export const storageService = new StorageService();
