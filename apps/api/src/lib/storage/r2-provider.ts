// Cloudflare R2 Storage Provider
// Implements the StorageProvider interface for R2

import type {
  StorageProvider,
  StorageProviderType,
  UploadInput,
  StoredFile,
  FileMetadata,
  ListFilesOptions,
  StorageUsage,
  StorageHealth,
  StorageCapabilities,
} from './types';
import { formatBytes } from './types';

export interface R2ProviderConfig {
  bucket: R2Bucket;
  publicDomain?: string;
  accountId?: string;
}

export class CloudflareR2Provider implements StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly type: StorageProviderType = 'cloudflare-r2';
  readonly capabilities: StorageCapabilities = {
    upload: true,
    download: true,
    streaming: true,
    directLinks: true,
    thumbnails: true,
    delete: true,
    folders: true,
    multipartUpload: true,
  };

  private bucket: R2Bucket;
  private publicDomain?: string;

  constructor(config: R2ProviderConfig, accountId?: string) {
    this.id = accountId || 'r2-default';
    this.name = 'Cloudflare R2';
    this.bucket = config.bucket;
    this.publicDomain = config.publicDomain;
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    const result = await this.bucket.put(input.key, input.body, {
      httpMetadata: {
        contentType: input.contentType || 'application/octet-stream',
        cacheControl: input.cacheControl || 'public, max-age=31536000',
      },
      customMetadata: input.metadata,
    });

    if (!result) {
      throw new Error('Failed to upload to R2');
    }

    return {
      key: result.key,
      etag: result.httpEtag,
      size: result.size,
      url: this.getPublicUrl(result.key),
      contentType: input.contentType,
      lastModified: result.uploaded,
    };
  }

  async delete(fileId: string): Promise<void> {
    await this.bucket.delete(fileId);
  }

  async getMetadata(fileId: string): Promise<FileMetadata> {
    const object = await this.bucket.head(fileId);
    if (!object) {
      throw new Error(`File not found: ${fileId}`);
    }

    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata.contentType,
      etag: object.httpEtag,
      lastModified: object.uploaded,
      metadata: object.customMetadata,
    };
  }

  async getStreamUrl(fileId: string): Promise<string> {
    // Check if file exists
    const object = await this.bucket.head(fileId);
    if (!object) {
      throw new Error(`File not found: ${fileId}`);
    }

    return this.getPublicUrl(fileId);
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    // Check if file exists
    const object = await this.bucket.head(fileId);
    if (!object) {
      throw new Error(`File not found: ${fileId}`);
    }

    return this.getPublicUrl(fileId);
  }

  async listFiles(options?: ListFilesOptions): Promise<StoredFile[]> {
    const result = await this.bucket.list({
      prefix: options?.prefix,
      limit: options?.limit || 100,
      cursor: options?.cursor,
    });

    return result.objects.map((obj) => ({
      key: obj.key,
      etag: obj.httpEtag,
      size: obj.size,
      url: this.getPublicUrl(obj.key),
      lastModified: obj.uploaded,
    }));
  }

  async getUsage(): Promise<StorageUsage> {
    let totalSize = 0;
    let objectCount = 0;
    let cursor: string | undefined;

    do {
      const result = await this.bucket.list({ limit: 1000, cursor });
      totalSize += result.objects.reduce((sum, obj) => sum + obj.size, 0);
      objectCount += result.objects.length;
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    // R2 free tier is 10GB, but this should come from account config
    const total = 10 * 1024 * 1024 * 1024; // 10GB default
    const available = Math.max(0, total - totalSize);
    const percentage = Math.min(100, (totalSize / total) * 100);

    return {
      used: totalSize,
      available,
      total,
      percentage,
      usedFormatted: formatBytes(totalSize),
      availableFormatted: formatBytes(available),
      totalFormatted: formatBytes(total),
    };
  }

  async healthCheck(): Promise<StorageHealth> {
    const startTime = Date.now();

    try {
      // Try to list a single object to verify connection
      await this.bucket.list({ limit: 1 });

      return {
        status: 'connected',
        message: 'Connection successful',
        lastChecked: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message || 'Connection failed',
        lastChecked: new Date(),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async disconnect(): Promise<void> {
    // R2 doesn't need disconnection - it's built into the Worker
    // This is a no-op for R2
  }

  // Helper methods
  getPublicUrl(key: string): string {
    if (this.publicDomain) {
      return `https://${this.publicDomain}/${key}`;
    }
    // Default R2.dev public URL (not recommended for production)
    return `https://pub-${key.split('/')[0]}.r2.dev/${key}`;
  }

  // Generate structured keys for Veyra
  generateMovieKey(movieId: number, quality: string, filename: string): string {
    const ext = filename.split('.').pop() || 'mp4';
    const timestamp = Date.now();
    return `movies/${movieId}/video/${quality}/${timestamp}-${filename}`;
  }

  generateEpisodeKey(
    movieId: number,
    seasonNumber: number,
    episodeNumber: number,
    quality: string,
    filename: string
  ): string {
    const timestamp = Date.now();
    return `series/${movieId}/seasons/${seasonNumber}/episodes/${episodeNumber}/video/${quality}/${timestamp}-${filename}`;
  }

  generateImageKey(
    movieId: number,
    type: 'poster' | 'backdrop' | 'thumbnail',
    filename: string
  ): string {
    const ext = filename.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    return `movies/${movieId}/${type}/${timestamp}.${ext}`;
  }

  generateSubtitleKey(movieId: number, filename: string): string {
    const timestamp = Date.now();
    return `movies/${movieId}/subtitles/${timestamp}-${filename}`;
  }

  generateTrailerKey(movieId: number, filename: string): string {
    const timestamp = Date.now();
    return `movies/${movieId}/trailers/${timestamp}-${filename}`;
  }
}
