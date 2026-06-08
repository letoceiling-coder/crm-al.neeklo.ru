import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export type StorageFolder = 'raw' | 'processed' | 'ocr' | 'chunks' | 'exports' | 'marketplace';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly configured: boolean;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'ru-3');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucket = this.config.get<string>('S3_BUCKET', 'crm-al-knowledge');

    this.configured = Boolean(endpoint && accessKeyId && secretAccessKey);
    if (this.configured) {
      this.client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        forcePathStyle: true,
      });
    } else {
      this.client = null;
      this.logger.warn('S3 not configured — storage operations will fail');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  buildKey(organizationId: string, folder: StorageFolder, ...parts: string[]): string {
    return [organizationId, folder, ...parts].join('/');
  }

  async upload(params: {
    key: string;
    body: Buffer | string | Readable;
    contentType?: string;
  }) {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
    return { key: params.key, bucket: this.bucket };
  }

  async download(key: string): Promise<Buffer> {
    const client = this.requireClient();
    const res = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string) {
    const client = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return { deleted: true, key };
  }

  async exists(key: string): Promise<boolean> {
    const client = this.requireClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ ok: boolean; bucket: string; configured: boolean }> {
    if (!this.configured || !this.client) {
      return { ok: false, bucket: this.bucket, configured: false };
    }
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: '__healthcheck__' }));
      return { ok: true, bucket: this.bucket, configured: true };
    } catch (err) {
      const code = (err as { name?: string }).name;
      if (code === 'NotFound' || code === 'NoSuchKey') {
        return { ok: true, bucket: this.bucket, configured: true };
      }
      return { ok: false, bucket: this.bucket, configured: true };
    }
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error('S3 storage is not configured');
    }
    return this.client;
  }
}
