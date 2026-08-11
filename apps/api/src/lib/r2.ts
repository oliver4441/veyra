// Cloudflare R2 Storage Provider
// Handles video uploads, downloads, and presigned URLs

export interface R2Config {
  bucket: R2Bucket;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicDomain?: string; // Custom domain for public access
}

export interface R2UploadResult {
  key: string;
  etag: string;
  size: number;
  url: string;
}

export interface R2UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export class R2StorageProvider {
  private bucket: R2Bucket;
  private publicDomain?: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.publicDomain = config.publicDomain;
  }

  // Upload a file to R2
  async upload(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    options: R2UploadOptions = {}
  ): Promise<R2UploadResult> {
    const result = await this.bucket.put(key, body, {
      httpMetadata: {
        contentType: options.contentType || 'application/octet-stream',
        cacheControl: options.cacheControl || 'public, max-age=31536000',
      },
      customMetadata: options.metadata,
    });

    if (!result) {
      throw new Error('Failed to upload to R2');
    }

    return {
      key: result.key,
      etag: result.httpEtag,
      size: result.size,
      url: this.getPublicUrl(result.key),
    };
  }

  // Get a file from R2
  async get(key: string): Promise<R2ObjectBody | null> {
    const object = await this.bucket.get(key);
    return object;
  }

  // Get file metadata without body
  async head(key: string): Promise<R2Object | null> {
    const object = await this.bucket.head(key);
    return object;
  }

  // Delete a file from R2
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  // Delete multiple files
  async deleteMany(keys: string[]): Promise<void> {
    await this.bucket.delete(keys);
  }

  // List files with prefix
  async list(options: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }> {
    const result = await this.bucket.list({
      prefix: options.prefix,
      limit: options.limit || 100,
      cursor: options.cursor,
    });

    return {
      objects: result.objects,
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined,
    };
  }

  // Get public URL for an object
  getPublicUrl(key: string): string {
    if (this.publicDomain) {
      return `https://${this.publicDomain}/${key}`;
    }
    // Default R2.dev public URL (not recommended for production)
    return `https://pub-${key.split('/')[0]}.r2.dev/${key}`;
  }

  // Generate a presigned URL for direct browser access
  // Note: Requires AWS SDK or manual signature generation
  getPresignedUrl(key: string, expiresIn: number = 3600): string {
    // For now, return the public URL if available
    // In production, use @aws-sdk/s3-request-presigner
    return this.getPublicUrl(key);
  }

  // Generate a unique key for a movie file
  generateMovieKey(
    movieId: number,
    quality: string,
    filename: string,
    type: 'video' | 'poster' | 'backdrop' | 'subtitle' = 'video'
  ): string {
    const ext = filename.split('.').pop() || 'mp4';
    const timestamp = Date.now();

    switch (type) {
      case 'video':
        return `movies/${movieId}/video/${quality}/${timestamp}-${filename}`;
      case 'poster':
        return `movies/${movieId}/poster/${timestamp}-poster.${ext}`;
      case 'backdrop':
        return `movies/${movieId}/backdrop/${timestamp}-backdrop.${ext}`;
      case 'subtitle':
        return `movies/${movieId}/subtitles/${timestamp}-${filename}`;
      default:
        return `movies/${movieId}/${type}/${timestamp}-${filename}`;
    }
  }

  // Generate a unique key for an episode file
  generateEpisodeKey(
    movieId: number,
    seasonNumber: number,
    episodeNumber: number,
    quality: string,
    filename: string
  ): string {
    const ext = filename.split('.').pop() || 'mp4';
    const timestamp = Date.now();
    return `series/${movieId}/s${seasonNumber}e${episodeNumber}/video/${quality}/${timestamp}-${filename}`;
  }

  // Get file size category for storage optimization
  getSizeCategory(fileSize: number): 'small' | 'medium' | 'large' | 'xlarge' {
    if (fileSize < 100 * 1024 * 1024) return 'small'; // < 100MB
    if (fileSize < 1024 * 1024 * 1024) return 'medium'; // < 1GB
    if (fileSize < 5 * 1024 * 1024 * 1024) return 'large'; // < 5GB
    return 'xlarge'; // 5GB+
  }
}

// Helper to create R2 provider from environment
export function createR2Provider(env: {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
}): R2StorageProvider {
  return new R2StorageProvider({
    bucket: env.R2_BUCKET,
    publicDomain: env.R2_PUBLIC_DOMAIN,
  });
}

// Generate checksum for file integrity
export async function generateChecksum(
  data: ArrayBuffer | ReadableStream
): Promise<string> {
  if (data instanceof ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // For streams, we'd need to accumulate the data first
  // This is a simplified version
  return 'stream-checksum';
}
