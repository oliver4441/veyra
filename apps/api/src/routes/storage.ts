import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { createR2Provider, generateChecksum } from '../lib/r2';
import { mediaFiles, movies, episodes } from '../db/schema';
import type { Env } from '../index';

const storage = new Hono<{ Bindings: Env }>();

// Middleware to check admin role for uploads
storage.use('/upload/*', async (c, next) => {
  const payload = (c as any).get('jwtPayload');
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ error: 'Admin access required for uploads' }, 403);
  }
  c.set('userId', payload.userId);
  await next();
});

// POST /api/storage/upload/movie - Upload a movie file
storage.post('/upload/movie', async (c) => {
  const userId = (c as any).get('userId') as number;
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const movieId = formData.get('movieId') as string;
    const quality = formData.get('quality') as string || '1080';

    if (!file || !movieId) {
      return c.json({ error: 'File and movieId are required' }, 400);
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: MP4, WebM, MOV, AVI' }, 400);
    }

    // Generate R2 key
    const key = r2.generateMovieKey(parseInt(movieId), quality, file.name, 'video');

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload(key, arrayBuffer, {
      contentType: file.type,
      metadata: {
        movieId,
        quality,
        uploadedBy: String(userId),
        originalFilename: file.name,
      },
    });

    // Generate checksum
    const checksum = await generateChecksum(arrayBuffer);

    // Save to database
    const db = getDb(c.env.DATABASE_URL);
    const [mediaFile] = await db
      .insert(mediaFiles)
      .values({
        movieId: parseInt(movieId),
        storageProvider: 'r2',
        r2Key: result.key,
        r2Bucket: 'veyra-media',
        publicUrl: result.url,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        quality: quality as any,
        checksum,
        status: 'uploaded',
      })
      .returning();

    return c.json({
      success: true,
      file: {
        id: mediaFile.id,
        key: result.key,
        url: result.url,
        size: file.size,
      },
    }, 201);
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({ error: error.message || 'Upload failed' }, 500);
  }
});

// POST /api/storage/upload/episode - Upload an episode file
storage.post('/upload/episode', async (c) => {
  const userId = (c as any).get('userId') as number;
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const episodeId = formData.get('episodeId') as string;
    const movieId = formData.get('movieId') as string;
    const seasonNumber = formData.get('seasonNumber') as string;
    const episodeNumber = formData.get('episodeNumber') as string;
    const quality = formData.get('quality') as string || '1080';

    if (!file || !episodeId || !movieId || !seasonNumber || !episodeNumber) {
      return c.json({ error: 'File, episodeId, movieId, seasonNumber, and episodeNumber are required' }, 400);
    }

    // Generate R2 key
    const key = r2.generateEpisodeKey(
      parseInt(movieId),
      parseInt(seasonNumber),
      parseInt(episodeNumber),
      quality,
      file.name
    );

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload(key, arrayBuffer, {
      contentType: file.type,
      metadata: {
        episodeId,
        movieId,
        seasonNumber,
        episodeNumber,
        quality,
        uploadedBy: String(userId),
        originalFilename: file.name,
      },
    });

    // Generate checksum
    const checksum = await generateChecksum(arrayBuffer);

    // Save to database
    const db = getDb(c.env.DATABASE_URL);
    const [mediaFile] = await db
      .insert(mediaFiles)
      .values({
        episodeId: parseInt(episodeId),
        storageProvider: 'r2',
        r2Key: result.key,
        r2Bucket: 'veyra-media',
        publicUrl: result.url,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        quality: quality as any,
        checksum,
        status: 'uploaded',
      })
      .returning();

    return c.json({
      success: true,
      file: {
        id: mediaFile.id,
        key: result.key,
        url: result.url,
        size: file.size,
      },
    }, 201);
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({ error: error.message || 'Upload failed' }, 500);
  }
});

// POST /api/storage/upload/image - Upload poster, backdrop, or thumbnail
storage.post('/upload/image', async (c) => {
  const userId = (c as any).get('userId') as number;
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const movieId = formData.get('movieId') as string;
    const type = formData.get('type') as string; // poster, backdrop, thumbnail

    if (!file || !movieId || !type) {
      return c.json({ error: 'File, movieId, and type are required' }, 400);
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP' }, 400);
    }

    // Generate R2 key
    const r2Type = type as 'poster' | 'backdrop' | 'subtitle';
    const key = r2.generateMovieKey(parseInt(movieId), 'original', file.name, r2Type);

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload(key, arrayBuffer, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
      metadata: {
        movieId,
        type,
        uploadedBy: String(userId),
      },
    });

    // Update movie record with the image URL
    const db = getDb(c.env.DATABASE_URL);
    const updateData: Record<string, any> = {};
    
    if (type === 'poster') {
      updateData.posterUrl = result.url;
    } else if (type === 'backdrop') {
      updateData.backdropUrl = result.url;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(movies).set(updateData).where(eq(movies.id, parseInt(movieId)));
    }

    return c.json({
      success: true,
      url: result.url,
      key: result.key,
    }, 201);
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({ error: error.message || 'Upload failed' }, 500);
  }
});

// GET /api/storage/download/:key - Get a download URL
storage.get('/download/:key', async (c) => {
  const key = c.req.param('key');
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  // Check if file exists
  const object = await r2.head(key);
  if (!object) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Return the public URL or a presigned URL
  const url = r2.getPublicUrl(key);

  return c.json({
    url,
    contentType: object.httpMetadata.contentType,
    size: object.size,
    etag: object.httpEtag,
  });
});

// DELETE /api/storage/:key - Delete a file
storage.delete('/:key', async (c) => {
  const userId = (c as any).get('userId') as number;
  const key = c.req.param('key');
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  // Check if file exists
  const object = await r2.head(key);
  if (!object) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Delete from R2
  await r2.delete(key);

  // Remove from database
  const db = getDb(c.env.DATABASE_URL);
  await db.delete(mediaFiles).where(eq(mediaFiles.r2Key, key));

  return c.json({ success: true });
});

// GET /api/storage/list - List files (admin only)
storage.get('/list', async (c) => {
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });
  const prefix = c.req.query('prefix') || '';
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor');

  const result = await r2.list({ prefix, limit, cursor });

  return c.json({
    objects: result.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      etag: obj.httpEtag,
      lastModified: obj.uploaded,
      url: r2.getPublicUrl(obj.key),
    })),
    truncated: result.truncated,
    cursor: result.cursor,
  });
});

// GET /api/storage/quota - Get storage usage (admin only)
storage.get('/quota', async (c) => {
  const r2 = createR2Provider({ bucket: c.env.R2_BUCKET, publicDomain: c.env.R2_PUBLIC_DOMAIN });

  // List all objects to calculate total size
  let totalSize = 0;
  let objectCount = 0;
  let cursor: string | undefined;

  do {
    const result = await r2.list({ limit: 1000, cursor });
    totalSize += result.objects.reduce((sum, obj) => sum + obj.size, 0);
    objectCount += result.objects.length;
    cursor = result.cursor;
  } while (cursor);

  return c.json({
    totalSize,
    objectCount,
    totalSizeFormatted: formatBytes(totalSize),
  });
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export { storage as storageRoutes };
