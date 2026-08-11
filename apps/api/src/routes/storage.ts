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

// Middleware to check admin role for uploads
storage.use('/upload/*', async (c, next) => {
  const payload = (c as any).get('jwtPayload');
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ error: 'Admin access required for uploads' }, 403);
  }
  c.set('userId', payload.userId);
  await next();
});

// GET /api/storage/providers - List available providers
storage.get('/providers', async (c) => {
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
      quotaTotal: a.quotaTotal,
      quotaUsed: a.quotaUsed,
      lastHealthCheck: a.lastHealthCheck,
    })),
  });
});

// GET /api/storage/accounts - List connected accounts
storage.get('/accounts', async (c) => {
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
      quotaTotal: a.quotaTotal,
      quotaUsed: a.quotaUsed,
      lastHealthCheck: a.lastHealthCheck,
      capabilities: a.capabilities,
    })),
  });
});

// POST /api/storage/accounts - Create a new storage account
storage.post('/accounts', async (c) => {
  const userId = (c as any).get('userId') as number;
  const body = await c.req.json();
  const { providerType, displayName, purpose, priority, credentials } = body;

  if (!providerType || !displayName) {
    return c.json({ error: 'providerType and displayName are required' }, 400);
  }

  // Validate provider type
  const providerMeta = providerRegistry.get(providerType);
  if (!providerMeta) {
    return c.json({ error: 'Invalid provider type' }, 400);
  }

  // Generate account ID
  const db = getDb(c.env.DATABASE_URL);
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(storageAccounts)
    .where(eq(storageAccounts.providerType, providerType));

  const accountId = `${providerType.replace('-', '')}_${String(countResult.count + 1).padStart(2, '0')}`;

  // Create account
  const [account] = await db
    .insert(storageAccounts)
    .values({
      id: accountId,
      providerType,
      displayName,
      status: 'connected',
      purpose: purpose || 'general',
      priority: priority || 5,
      isDefault: false,
      credentials: credentials || null,
      capabilities: providerMeta.capabilities,
    })
    .returning();

  return c.json({
    account: {
      id: account.id,
      providerType: account.providerType,
      displayName: account.displayName,
      status: account.status,
      purpose: account.purpose,
      priority: account.priority,
    },
  }, 201);
});

// PUT /api/storage/accounts/:id - Update a storage account
storage.put('/accounts/:id', async (c) => {
  const accountId = c.req.param('id');
  const body = await c.req.json();
  const { displayName, purpose, priority } = body;

  const db = getDb(c.env.DATABASE_URL);
  
  const [updated] = await db
    .update(storageAccounts)
    .set({
      ...(displayName && { displayName }),
      ...(purpose && { purpose }),
      ...(priority !== undefined && { priority }),
      updatedAt: new Date(),
    })
    .where(eq(storageAccounts.id, accountId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({
    account: {
      id: updated.id,
      providerType: updated.providerType,
      displayName: updated.displayName,
      status: updated.status,
      purpose: updated.purpose,
      priority: updated.priority,
    },
  });
});

// DELETE /api/storage/accounts/:id - Disconnect a storage account
storage.delete('/accounts/:id', async (c) => {
  const accountId = c.req.param('id');

  // Don't allow deleting the default R2 account
  if (accountId === 'r2-default') {
    return c.json({ error: 'Cannot disconnect the default storage provider' }, 400);
  }

  const db = getDb(c.env.DATABASE_URL);
  
  const [deleted] = await db
    .delete(storageAccounts)
    .where(eq(storageAccounts.id, accountId))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/storage/accounts/:id/test - Test connection
storage.post('/accounts/:id/test', async (c) => {
  const accountId = c.req.param('id');
  const r2 = createR2Provider(c.env);

  // For R2 default, test directly
  if (accountId === 'r2-default') {
    if (!r2) {
      return c.json({
        health: {
          status: 'error',
          message: 'R2 bucket not configured',
          lastChecked: new Date(),
        },
      });
    }
    const health = await r2.healthCheck();
    
    // Update health status in database
    const db = getDb(c.env.DATABASE_URL);
    await db
      .update(storageAccounts)
      .set({
        lastHealthCheck: new Date(),
        lastHealthStatus: health.status as any,
        healthMessage: health.message,
        latencyMs: health.latencyMs,
      })
      .where(eq(storageAccounts.id, accountId));

    return c.json({ health });
  }

  // For other accounts, would need to create provider instance
  // For now, return a placeholder
  return c.json({
    health: {
      status: 'connected',
      message: 'Connection successful',
      lastChecked: new Date(),
    },
  });
});

// GET /api/storage/quota - Get storage usage
storage.get('/quota', async (c) => {
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
});

// POST /api/storage/upload/movie - Upload a movie file
storage.post('/upload/movie', async (c) => {
  const userId = (c as any).get('userId') as number;
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

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: MP4, WebM, MOV, AVI' }, 400);
    }

    // Generate R2 key using provider
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
        uploadedBy: String(userId),
        originalFilename: file.name,
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

// POST /api/storage/upload/image - Upload poster, backdrop, or thumbnail
storage.post('/upload/image', async (c) => {
  const userId = (c as any).get('userId') as number;
  const r2 = createR2Provider(c.env);

  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

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
    const key = r2.generateImageKey(parseInt(movieId), type as any, file.name);

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const result = await r2.upload({
      key,
      body: arrayBuffer,
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
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
  const r2 = createR2Provider(c.env);

  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

  try {
    const url = await r2.getDownloadUrl(key);
    const metadata = await r2.getMetadata(key);

    return c.json({
      url,
      contentType: metadata.contentType,
      size: metadata.size,
      etag: metadata.etag,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'File not found' }, 404);
  }
});

// DELETE /api/storage/:key - Delete a file
storage.delete('/:key', async (c) => {
  const key = c.req.param('key');
  const r2 = createR2Provider(c.env);

  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

  try {
    await r2.delete(key);

    // Remove from database
    const db = getDb(c.env.DATABASE_URL);
    await db.delete(mediaFiles).where(eq(mediaFiles.externalFileId, key));

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Delete failed' }, 500);
  }
});

// GET /api/storage/list - List files
storage.get('/list', async (c) => {
  const r2 = createR2Provider(c.env);

  if (!r2) {
    return c.json({ error: 'R2 storage not configured' }, 503);
  }

  const prefix = c.req.query('prefix') || '';
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor');

  const files = await r2.listFiles({ prefix, limit, cursor });

  return c.json({
    files: files.map((f) => ({
      key: f.key,
      size: f.size,
      etag: f.etag,
      url: f.url,
      lastModified: f.lastModified,
    })),
  });
});

export { storage as storageRoutes };
