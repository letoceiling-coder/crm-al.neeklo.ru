#!/usr/bin/env node
/**
 * Stage 8.8 — S3 bucket remediation + CRUD validation (Selectel).
 * Run on server: node deploy/stage-8-8-s3-validation.js
 */
const path = require('path');
const fs = require('fs');

// Resolve @aws-sdk from monorepo root
const ROOT = '/var/www/crm-al-tokens';
process.chdir(ROOT);
module.paths.unshift(path.join(ROOT, 'node_modules'));

// Load .env from apps/api
const envPath = '/var/www/crm-al-tokens/apps/api/.env';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || 'ru-3';
const bucket = process.env.S3_BUCKET || 'crm-al-knowledge';
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;

const results = { date: new Date().toISOString(), env: {}, ops: {} };

function mask(v) {
  if (!v) return '(missing)';
  if (v.length <= 8) return '***';
  return v.slice(0, 4) + '***' + v.slice(-4);
}

results.env = {
  S3_ENDPOINT: endpoint || '(missing)',
  S3_REGION: region,
  S3_BUCKET: bucket,
  S3_ACCESS_KEY: mask(accessKeyId),
  S3_SECRET_KEY: mask(secretAccessKey),
  configured: Boolean(endpoint && accessKeyId && secretAccessKey),
};

async function main() {
  if (!results.env.configured) {
    console.log(JSON.stringify({ ...results, error: 'S3 not configured' }, null, 2));
    process.exit(1);
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const testKey = `__stage88_validation__/${Date.now()}.txt`;
  const testBody = 'Stage 8.8 S3 validation object';

  // HEAD Bucket
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    results.ops.headBucket = { ok: true, note: 'bucket exists' };
  } catch (err) {
    const code = err.name || err.Code;
    if (code === 'NotFound' || code === 'NoSuchBucket' || code === '404') {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        results.ops.createBucket = { ok: true, bucket };
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        results.ops.headBucket = { ok: true, note: 'created then verified' };
      } catch (createErr) {
        results.ops.createBucket = { ok: false, error: createErr.message };
        console.log(JSON.stringify(results, null, 2));
        process.exit(1);
      }
    } else {
      results.ops.headBucket = { ok: false, error: err.message, code };
      console.log(JSON.stringify(results, null, 2));
      process.exit(1);
    }
  }

  // PUT
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: testBody,
        ContentType: 'text/plain',
      }),
    );
    results.ops.putObject = { ok: true, key: testKey };
  } catch (err) {
    results.ops.putObject = { ok: false, error: err.message };
  }

  // HEAD Object
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: testKey }));
    results.ops.headObject = { ok: true };
  } catch (err) {
    results.ops.headObject = { ok: false, error: err.message };
  }

  // GET
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');
    results.ops.getObject = { ok: body === testBody, bytes: body.length };
  } catch (err) {
    results.ops.getObject = { ok: false, error: err.message };
  }

  // DELETE
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    results.ops.deleteObject = { ok: true };
  } catch (err) {
    results.ops.deleteObject = { ok: false, error: err.message };
  }

  const allOk = Object.values(results.ops).every((o) => o.ok !== false);
  results.overall = allOk ? 'PASS' : 'FAIL';
  console.log(JSON.stringify(results, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
