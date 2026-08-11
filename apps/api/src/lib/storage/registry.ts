// Provider Registry
// Manages available storage providers and their metadata

import type {
  ProviderMetadata,
  ProviderRegistry,
  StorageProviderType,
  StorageCapabilities,
} from './types';

// Built-in provider metadata
const PROVIDER_REGISTRY: Map<StorageProviderType, ProviderMetadata> = new Map();

// Initialize with Cloudflare R2 as the default
PROVIDER_REGISTRY.set('cloudflare-r2', {
  type: 'cloudflare-r2',
  name: 'Cloudflare R2',
  description: 'Fast, S3-compatible object storage with zero egress fees. Built into Veyra.',
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
  logoUrl: '/icons/providers/r2.svg',
  websiteUrl: 'https://www.cloudflare.com/r2/',
});

// Optional providers (for future implementation)
PROVIDER_REGISTRY.set('terabox', {
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
  logoUrl: '/icons/providers/terabox.svg',
  websiteUrl: 'https://www.terabox.com/',
  setupUrl: '/admin/storage/connect/terabox',
});

PROVIDER_REGISTRY.set('google-drive', {
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
  logoUrl: '/icons/providers/gdrive.svg',
  websiteUrl: 'https://drive.google.com/',
  setupUrl: '/admin/storage/connect/google-drive',
});

PROVIDER_REGISTRY.set('backblaze-b2', {
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
  logoUrl: '/icons/providers/b2.svg',
  websiteUrl: 'https://www.backblaze.com/b2/',
  setupUrl: '/admin/storage/connect/b2',
});

PROVIDER_REGISTRY.set('dropbox', {
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
  logoUrl: '/icons/providers/dropbox.svg',
  websiteUrl: 'https://www.dropbox.com/',
  setupUrl: '/admin/storage/connect/dropbox',
});

PROVIDER_REGISTRY.set('mega', {
  type: 'mega',
  name: 'MEGA',
  description: 'Encrypted cloud storage.',
  authType: 'credentials',
  capabilities: {
    upload: true,
    download: true,
    streaming: false,
    directLinks: true,
    thumbnails: false,
    delete: true,
    folders: true,
    multipartUpload: true,
  },
  logoUrl: '/icons/providers/mega.svg',
  websiteUrl: 'https://mega.nz/',
  setupUrl: '/admin/storage/connect/mega',
});

PROVIDER_REGISTRY.set('s3-compatible', {
  type: 's3-compatible',
  name: 'S3-Compatible',
  description: 'Custom S3-compatible object storage (MinIO, DigitalOcean Spaces, etc.).',
  authType: 'credentials',
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
  logoUrl: '/icons/providers/s3.svg',
  setupUrl: '/admin/storage/connect/s3',
});

// Registry implementation
export const providerRegistry: ProviderRegistry = {
  register(provider: ProviderMetadata): void {
    PROVIDER_REGISTRY.set(provider.type, provider);
  },

  get(type: StorageProviderType): ProviderMetadata | null {
    return PROVIDER_REGISTRY.get(type) || null;
  },

  getAll(): ProviderMetadata[] {
    return Array.from(PROVIDER_REGISTRY.values());
  },

  getSupported(): StorageProviderType[] {
    return Array.from(PROVIDER_REGISTRY.keys());
  },

  // Get providers by auth type
  getOAuthProviders(): ProviderMetadata[] {
    return this.getAll().filter((p) => p.authType === 'oauth');
  },

  getCredentialsProviders(): ProviderMetadata[] {
    return this.getAll().filter((p) => p.authType === 'credentials');
  },

  // Get providers that are not the default (for "Add Provider" UI)
  getOptionalProviders(): ProviderMetadata[] {
    return this.getAll().filter((p) => p.type !== 'cloudflare-r2');
  },
};
