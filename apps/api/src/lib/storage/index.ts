// Storage Module
// Exports all storage-related functionality

export * from './types';
export { CloudflareR2Provider } from './r2-provider';
export type { R2ProviderConfig } from './r2-provider';
export { providerRegistry } from './registry';
export { StorageManager, createStorageManager } from './manager';
export type { StorageManagerConfig } from './manager';
