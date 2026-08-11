// Storage Provider Types and Interfaces
// Core abstraction for the multi-provider storage system

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

export type AuthType = 'oauth' | 'credentials' | 'built-in';

export interface UploadInput {
  key: string;
  body: ReadableStream | ArrayBuffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface StoredFile {
  key: string;
  etag?: string;
  size: number;
  url: string;
  contentType?: string;
  lastModified?: Date;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface ListFilesOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface StorageUsage {
  used: number;
  available: number;
  total: number;
  percentage: number;
  usedFormatted: string;
  availableFormatted: string;
  totalFormatted: string;
}

export interface StorageHealth {
  status: StorageHealthStatus;
  message?: string;
  lastChecked: Date;
  latencyMs?: number;
}

export interface StorageCapabilities {
  upload: boolean;
  download: boolean;
  streaming: boolean;
  directLinks: boolean;
  thumbnails: boolean;
  delete: boolean;
  folders: boolean;
  multipartUpload: boolean;
}

export interface ProviderMetadata {
  type: StorageProviderType;
  name: string;
  description: string;
  authType: AuthType;
  capabilities: StorageCapabilities;
  logoUrl?: string;
  websiteUrl?: string;
  setupUrl?: string;
}

// Main Storage Provider Interface
export interface StorageProvider {
  id: string;
  name: string;
  type: StorageProviderType;

  upload(input: UploadInput): Promise<StoredFile>;
  delete(fileId: string): Promise<void>;
  getMetadata(fileId: string): Promise<FileMetadata>;
  getStreamUrl(fileId: string): Promise<string>;
  getDownloadUrl(fileId: string): Promise<string>;
  listFiles(options?: ListFilesOptions): Promise<StoredFile[]>;
  getUsage(): Promise<StorageUsage>;
  healthCheck(): Promise<StorageHealth>;
  disconnect?(): Promise<void>;
}

// Storage Router Interface
export interface StorageRouter {
  selectProvider(
    purpose: StoragePurpose,
    requirements?: Partial<StorageCapabilities>
  ): Promise<StorageProvider>;
  getProvider(accountId: string): Promise<StorageProvider | null>;
  getAllProviders(): Promise<StorageProvider[]>;
}

// Provider Registry for dynamic registration
export interface ProviderRegistry {
  register(provider: ProviderMetadata): void;
  get(type: StorageProviderType): ProviderMetadata | null;
  getAll(): ProviderMetadata[];
  getSupported(): StorageProviderType[];
}

// Database models
export interface StorageAccount {
  id: string;
  providerType: StorageProviderType;
  displayName: string;
  status: StorageHealthStatus;
  purpose: StoragePurpose;
  priority: number;
  isDefault: boolean;
  quotaTotal: number;
  quotaUsed: number;
  lastHealthCheck: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageAccountCredentials {
  // R2 credentials (stored encrypted in DB)
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2PublicDomain?: string;

  // OAuth credentials (for future providers)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;

  // Generic credentials
  apiKey?: string;
  apiSecret?: string;
  endpoint?: string;
}

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to get warning level based on usage percentage
export function getUsageWarningLevel(percentage: number): 'normal' | 'warning' | 'critical' | 'full' {
  if (percentage >= 100) return 'full';
  if (percentage >= 95) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'normal';
}
