import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { CloudflareR2Provider } from '../lib/storage/r2-provider';
import { providerRegistry } from '../lib/storage/registry';
import { mediaFiles, movies, storageAccounts } from '../db/schema';
import type { Env } from '../index';

const storage = new Hono<{ Bindings: Env }>();

// Helper to create R2 provider from environment
function createR2Provider(env: Env): CloudflareR2Provider | null {
  if (!env.R2_BUCKET) {
    return null;
  }
  return new CloudflareR2Provider({
    bucket: env.R2_BUCKET,
    publicDomain: env.R2_PUBLIC_DOMAIN,
  }, 'r2-default');
}

// GET /api/storage/providers - List available providers
storage.get('/providers', async (c) => {
  try {
    const providers = providerRegistry.getAll();
    
    // Get connected accounts from database
    const db = getDb(c.env.DATABASE_URL);
    const accounts = await db
      .select()
      .from(storageAccounts)
      .orderBy(desc(storageAccounts.priority));

    return c.json({
      providers: providers.map((p) => ({
        ...p,
        connected: accounts.some((a) => a.providerType === p.type && a.status === 'connected'),
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        providerType: a.providerType,
        displayName: a.displayName,
        status: a.status,
        purpose: a.purpose,
        priority: a.priority,
        isDefault: a.isDefault,
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message });
  }
});

// GET /api/storage/accounts - List connected accounts
storage.get('/accounts', async (c) => {
  try {
    const db = getDb(c.env.DATABASE_URL);
    
    const accounts = await db
      .select()
      .from(storageAccounts)
      .orderBy(desc(storageAccounts.isDefault), desc(storageAccounts.priority));

    return c.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        providerType: a.providerType,
        displayName: a.displayName,
        status: a.status,
        purpose: a.purpose,
        priority: a.priority,
        isDefault: a.isDefault,
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message });
  }
});

// GET /api/storage/quota - Get storage usage
storage.get('/quota', async (c) => {
  try {
    const r2 = createR2Provider(c.env);
    const db = getDb(c.env.DATABASE_URL);

    // Get R2 usage if available
    let r2Usage = null;
    if (r2) {
      try {
        r2Usage = await r2.getUsage();
      } catch {
        // Ignore errors
      }
    }

    // Get total file count and size from database
    const [fileStats] = await db
      .select({
        count: sql<number>`count(*)`,
        totalSize: sql<number>`coalesce(sum(${mediaFiles.fileSize}), 0)`,
      })
      .from(mediaFiles);

    return c.json({
      r2: r2Usage ? {
        used: r2Usage.used,
        available: r2Usage.available,
        total: r2Usage.total,
        percentage: r2Usage.percentage,
        usedFormatted: r2Usage.usedFormatted,
        availableFormatted: r2Usage.availableFormatted,
        totalFormatted: r2Usage.totalFormatted,
      } : {
        used: 0,
        available: 10 * 1024 * 1024 * 1024,
        total: 10 * 1024 * 1024 * 1024,
        percentage: 0,
        usedFormatted: '0 Bytes',
        availableFormatted: '10 GB',
        totalFormatted: '10 GB',
      },
      files: {
        count: fileStats.count,
        totalSize: fileStats.totalSize,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message });
  }
});

// POST /api/storage/upload/movie - Upload a movie file
storage.post('/upload/movie', async (c) => {
  const r2 = createR2Provider(c.env);
  
  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const movieId = formData.get('movieId') as string;
    const quality = formData.get('quality') as string || '1080';

    if (!file || !movieId) {
      return c.json({ error: 'File and movieId are required' }, 400);
    }

    // Generate R2 key
    const key = r2.generateMovieKey(parseInt(movieId), quality, file.name);

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload({
      key,
      body: arrayBuffer,
      contentType: file.type,
      metadata: {
        movieId,
        quality,
      },
    });

    // Save to database
    const db = getDb(c.env.DATABASE_URL);
    const [mediaFile] = await db
      .insert(mediaFiles)
      .values({
        movieId: parseInt(movieId),
        storageAccountId: 'r2-default',
        externalFileId: result.key,
        objectPath: result.key,
        publicUrl: result.url,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        quality: quality as any,
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

// POST /api/storage/upload/image - Upload an image file (poster, backdrop, etc.)
storage.post('/upload/image', async (c) => {
  const r2 = createR2Provider(c.env);
  
  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const movieId = formData.get('movieId') as string;
    const type = formData.get('type') as string || 'poster';

    if (!file) {
      return c.json({ error: 'File is required' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'File must be an image' }, 400);
    }

    // Generate R2 key for image
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'jpg';
    const key = `veyra/images/${type}/${movieId || 'unknown'}_${timestamp}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload({
      key,
      body: arrayBuffer,
      contentType: file.type,
      metadata: {
        type,
        movieId: movieId || '',
      },
    });

    // If movieId provided, save to database
    let mediaFile = null;
    if (movieId) {
      const db = getDb(c.env.DATABASE_URL);
      [mediaFile] = await db
        .insert(mediaFiles)
        .values({
          movieId: parseInt(movieId),
          storageAccountId: 'r2-default',
          externalFileId: result.key,
          objectPath: result.key,
          publicUrl: result.url,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          quality: 'original' as any,
          status: 'uploaded',
        })
        .returning();
    }

    return c.json({
      success: true,
      file: {
        id: mediaFile?.id,
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

// DELETE /api/storage/files/:id - Delete a file
storage.delete('/files/:id', async (c) => {
  const r2 = createR2Provider(c.env);
  const fileId = parseInt(c.req.param('id'));

  try {
    const db = getDb(c.env.DATABASE_URL);
    
    // Get file record
    const [file] = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, fileId))
      .limit(1);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Delete from R2 if available
    if (r2 && file.objectPath) {
      try {
        await r2.delete(file.objectPath);
      } catch (error) {
        console.error('Failed to delete from R2:', error);
      }
    }

    // Delete from database
    await db.delete(mediaFiles).where(eq(mediaFiles.id, fileId));

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Delete failed' }, 500);
  }
});

export { storage as storageRoutes };
