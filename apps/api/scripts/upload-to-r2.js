#!/usr/bin/env node
/**
 * Upload files to Cloudflare R2 using S3-compatible API
 * Usage: node upload-to-r2.js <local-file> <r2-key>
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// R2 Configuration
const R2_CONFIG = {
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
};

const BUCKET = process.env.R2_BUCKET || 'veyra-media';

async function uploadFile(localFilePath, r2Key, contentType = 'video/mp4') {
  const client = new S3Client(R2_CONFIG);
  
  const fileStats = fs.statSync(localFilePath);
  const fileSizeGB = (fileStats.size / (1024 * 1024 * 1024)).toFixed(2);
  
  console.log(`\n📦 Uploading: ${path.basename(localFilePath)}`);
  console.log(`   Size: ${fileSizeGB} GB`);
  console.log(`   Target: ${BUCKET}/${r2Key}`);
  console.log(`   Content-Type: ${contentType}\n`);
  
  const fileStream = fs.createReadStream(localFilePath);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: fileStream,
    ContentType: contentType,
    // Enable public access
    ACL: 'public-read',
  });
  
  try {
    await client.send(command);
    console.log(`✅ Upload complete: ${r2Key}`);
    
    // Verify the upload
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
    });
    const headResult = await client.send(headCommand);
    console.log(`   ETag: ${headResult.ETag}`);
    console.log(`   Size: ${(headResult.ContentLength / (1024 * 1024)).toFixed(2)} MB`);
    
    return true;
  } catch (error) {
    console.error(`❌ Upload failed: ${error.message}`);
    return false;
  }
}

async function main() {
  const [,, localFilePath, r2Key] = process.argv;
  
  if (!localFilePath || !r2Key) {
    console.error('Usage: node upload-to-r2.js <local-file> <r2-key>');
    console.error('Example: node upload-to-r2.js ./video.mp4 movies/14/video/1080.mp4');
    process.exit(1);
  }
  
  if (!fs.existsSync(localFilePath)) {
    console.error(`File not found: ${localFilePath}`);
    process.exit(1);
  }
  
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error('Missing required environment variables:');
    console.error('  R2_ACCOUNT_ID');
    console.error('  R2_ACCESS_KEY_ID');
    console.error('  R2_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  
  const contentType = localFilePath.endsWith('.mp4') ? 'video/mp4' :
                      localFilePath.endsWith('.webm') ? 'video/webm' :
                      localFilePath.endsWith('.mkv') ? 'video/x-matroska' :
                      'application/octet-stream';
  
  const success = await uploadFile(localFilePath, r2Key, contentType);
  process.exit(success ? 0 : 1);
}

main();
