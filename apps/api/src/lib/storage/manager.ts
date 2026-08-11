// Storage Manager
// Handles provider selection, routing, and orchestration

import type {
  StorageProvider,
  StorageRouter,
  StoragePurpose,
  StorageCapabilities,
  StorageUsage,
  StorageHealth,
  StorageAccount,
} from './types';
import { CloudflareR2Provider } from './r2-provider';

export interface StorageManagerConfig {
  r2Bucket: R2Bucket;
  r2PublicDomain?: string;
  accounts?: StorageAccount[];
}

export class StorageManager implements StorageRouter {
  private providers: Map<string, StorageProvider> = new Map();
  private accounts: StorageAccount[] = [];
  private r2Bucket: R2Bucket;
  private r2PublicDomain?: string;

  constructor(config: StorageManagerConfig) {
    this.r2Bucket = config.r2Bucket;
    this.r2PublicDomain = config.r2PublicDomain;
    this.accounts = config.accounts || [];

    // Always initialize R2 as the default provider
    this.initializeR2();
  }

  private initializeR2(): void {
    const r2Provider = new CloudflareR2Provider(
      {
        bucket: this.r2Bucket,
        publicDomain: this.r2PublicDomain,
      },
      'r2-default'
    );
    this.providers.set('r2-default', r2Provider);
  }

  // Select the best provider for a given purpose
  async selectProvider(
    purpose: StoragePurpose,
    requirements?: Partial<StorageCapabilities>
  ): Promise<StorageProvider> {
    // Get healthy accounts for the purpose
    const healthyAccounts = this.accounts.filter(
      (a) => a.status === 'connected' && (a.purpose === purpose || a.purpose === 'general')
    );

    // Sort by priority (higher = better)
    const sortedAccounts = healthyAccounts.sort((a, b) => b.priority - a.priority);

    // Try each account until we find one that meets requirements
    for (const account of sortedAccounts) {
      const provider = this.providers.get(account.id);
      if (provider) {
        // Check if provider meets requirements
        if (requirements && !this.meetsRequirements(provider.capabilities, requirements)) {
          continue;
        }
        return provider;
      }
    }

    // Fall back to R2 if no other provider is available
    const r2Provider = this.providers.get('r2-default');
    if (r2Provider) {
      return r2Provider;
    }

    throw new Error('No storage provider available');
  }

  // Get a specific provider by account ID
  async getProvider(accountId: string): Promise<StorageProvider | null> {
    return this.providers.get(accountId) || null;
  }

  // Get all available providers
  async getAllProviders(): Promise<StorageProvider[]> {
    return Array.from(this.providers.values());
  }

  // Get default provider (R2)
  getDefaultProvider(): StorageProvider | null {
    return this.providers.get('r2-default') || null;
  }

  // Register a new provider
  registerProvider(accountId: string, provider: StorageProvider): void {
    this.providers.set(accountId, provider);
  }

  // Remove a provider
  removeProvider(accountId: string): void {
    this.providers.delete(accountId);
  }

  // Update accounts list
  updateAccounts(accounts: StorageAccount[]): void {
    this.accounts = accounts;
  }

  // Check if provider capabilities meet requirements
  private meetsRequirements(
    capabilities: StorageCapabilities,
    requirements: Partial<StorageCapabilities>
  ): boolean {
    for (const [key, value] of Object.entries(requirements)) {
      if (value === true && capabilities[key as keyof StorageCapabilities] !== true) {
        return false;
      }
    }
    return true;
  }

  // Get aggregate usage across all providers
  async getAggregateUsage(): Promise<StorageUsage> {
    let totalUsed = 0;
    let totalAvailable = 0;
    let totalSpace = 0;

    for (const provider of this.providers.values()) {
      try {
        const usage = await provider.getUsage();
        totalUsed += usage.used;
        totalAvailable += usage.available;
        totalSpace += usage.total;
      } catch {
        // Skip providers that fail health check
      }
    }

    const percentage = totalSpace > 0 ? (totalUsed / totalSpace) * 100 : 0;

    return {
      used: totalUsed,
      available: totalAvailable,
      total: totalSpace,
      percentage: Math.min(100, percentage),
      usedFormatted: formatBytes(totalUsed),
      availableFormatted: formatBytes(totalAvailable),
      totalFormatted: formatBytes(totalSpace),
    };
  }

  // Health check all providers
  async healthCheckAll(): Promise<Map<string, StorageHealth>> {
    const results = new Map<string, StorageHealth>();

    for (const [id, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        results.set(id, health);
      } catch (error: any) {
        results.set(id, {
          status: 'error',
          message: error.message,
          lastChecked: new Date(),
        });
      }
    }

    return results;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Factory function to create storage manager from environment
export function createStorageManager(env: {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
}): StorageManager {
  return new StorageManager({
    r2Bucket: env.R2_BUCKET,
    r2PublicDomain: env.R2_PUBLIC_DOMAIN,
  });
}
