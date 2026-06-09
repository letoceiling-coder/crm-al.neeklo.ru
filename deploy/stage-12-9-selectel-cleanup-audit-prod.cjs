#!/usr/bin/env node
/**
 * Stage 12.9 — ETAP 8: Selectel Storage Cleanup Audit
 * Identifies orphan files (raw/processed) not referenced by any DB document.
 * READ-ONLY. No deletions.
 */
'use strict';
process.chdir('/var/www/crm-al-tokens/apps/api');
const { PrismaClient } = require('@prisma/client');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');

const OUT = process.env.AUDIT_OUT || '/tmp/stage-12-9-selectel-cleanup-plan.json';
const ENV_PATH = process.env.ENV_PATH || '/var/www/crm-al-tokens/apps/api/.env';

function loadEnv() {
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = raw.split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return {
    endpoint: env.S3_ENDPOINT || env.SELECTEL_ENDPOINT,
    region: env.S3_REGION || env.SELECTEL_REGION || 'ru-1',
    accessKey: env.S3_ACCESS_KEY_ID || env.SELECTEL_ACCESS_KEY,
    secretKey: env.S3_SECRET_ACCESS_KEY || env.SELECTEL_SECRET_KEY,
    bucket: env.S3_BUCKET || env.SELECTEL_BUCKET,
  };
}

const p = new PrismaClient();

async function main() {
  const cfg = loadEnv();
  if (!cfg.endpoint || !cfg.bucket) {
    throw new Error('S3 config missing — check ENV_PATH');
  }

  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
    forcePathStyle: true,
  });

  // 1. List all S3 objects
  const s3Keys = new Set();
  const s3Objects = [];
  let token;
  let totalBytes = 0;

  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: cfg.bucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const obj of res.Contents || []) {
      s3Keys.add(obj.Key);
      s3Objects.push({ key: obj.Key, size: obj.Size || 0, lastModified: obj.LastModified });
      totalBytes += obj.Size || 0;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  console.log(`S3 inventory: ${s3Keys.size} objects, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  // 2. Get all referenced S3 keys from DB
  const referencedKeys = new Set();

  // Raw S3 keys from documents
  const rawKeys = await p.$queryRaw`
    SELECT raw_s3_key FROM knowledge_documents WHERE raw_s3_key IS NOT NULL
  `;
  for (const r of rawKeys) referencedKeys.add(r.raw_s3_key);

  // Processed S3 keys from documents
  const processedKeys = await p.$queryRaw`
    SELECT processed_s3_key FROM knowledge_documents WHERE processed_s3_key IS NOT NULL
  `;
  for (const r of processedKeys) referencedKeys.add(r.processed_s3_key);

  // Version S3 keys
  const versionKeys = await p.$queryRaw`
    SELECT s3_key FROM knowledge_document_versions WHERE s3_key IS NOT NULL
  `;
  for (const r of versionKeys) referencedKeys.add(r.s3_key);

  console.log(`DB-referenced keys: ${referencedKeys.size}`);

  // 3. Find orphan objects
  const orphans = [];
  const referenced = [];

  for (const obj of s3Objects) {
    if (referencedKeys.has(obj.key)) {
      referenced.push(obj.key);
    } else {
      orphans.push(obj);
    }
  }

  // 4. Categorize orphans by folder
  const orphansByFolder = {};
  let orphanBytes = 0;
  for (const obj of orphans) {
    const parts = obj.key.split('/');
    const folder = parts[1] || 'root';
    if (!orphansByFolder[folder]) orphansByFolder[folder] = { count: 0, bytes: 0, examples: [] };
    orphansByFolder[folder].count++;
    orphansByFolder[folder].bytes += obj.size;
    orphanBytes += obj.size;
    if (orphansByFolder[folder].examples.length < 3) {
      orphansByFolder[folder].examples.push(obj.key);
    }
  }

  // 5. Safety check: are any orphans from active KB documents?
  const activeDocKeys = new Set();
  const activeDocs = await p.$queryRaw`
    SELECT raw_s3_key, processed_s3_key
    FROM knowledge_documents
    WHERE status IN ('READY', 'PROCESSING', 'PENDING')
    AND (raw_s3_key IS NOT NULL OR processed_s3_key IS NOT NULL)
  `;
  for (const r of activeDocs) {
    if (r.raw_s3_key) activeDocKeys.add(r.raw_s3_key);
    if (r.processed_s3_key) activeDocKeys.add(r.processed_s3_key);
  }

  const safeToDelete = orphans.filter(o => !activeDocKeys.has(o.key));
  const unsafeOrphans = orphans.filter(o => activeDocKeys.has(o.key));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalS3Objects: s3Keys.size,
      totalS3Bytes: totalBytes,
      totalS3MB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
      dbReferencedKeys: referencedKeys.size,
      orphanCount: orphans.length,
      orphanBytes,
      orphanMB: parseFloat((orphanBytes / 1024 / 1024).toFixed(2)),
      safeToDeleteCount: safeToDelete.length,
      unsafeOrphanCount: unsafeOrphans.length,
    },
    orphansByFolder,
    orphanObjects: orphans.map(o => ({ key: o.key, size: o.size })),
    safeToDelete: safeToDelete.map(o => ({ key: o.key, size: o.size })),
    unsafeOrphans: unsafeOrphans.map(o => ({ key: o.key, size: o.size })),
    cleanupPlan: [
      `Total orphan objects: ${orphans.length} (${(orphanBytes / 1024 / 1024).toFixed(2)} MB)`,
      `Safe to delete: ${safeToDelete.length} objects`,
      `Unsafe / needs review: ${unsafeOrphans.length} objects`,
      'ACTION: Review safeToDelete list before deletion',
      'ACTION: Do NOT delete any objects in unsafeOrphans without investigation',
      'ACTION: Before deleting, create a backup manifest of object keys',
      'COMMAND (when ready): node deploy/stage-12-9-selectel-delete-orphans-prod.cjs',
    ],
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    totalObjects: s3Keys.size,
    referenced: referencedKeys.size,
    orphans: orphans.length,
    safeToDelete: safeToDelete.length,
    orphanMB: report.summary.orphanMB,
    outputFile: OUT,
  }, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
