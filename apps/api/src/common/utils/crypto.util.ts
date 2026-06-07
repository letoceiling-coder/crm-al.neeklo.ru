import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const KEY_ENC_ALGO = 'aes-256-gcm';

function encryptionKey(): Buffer {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    'dev-only-change-me';
  return createHash('sha256').update(secret).digest();
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(KEY_ENC_ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptApiKey(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(KEY_ENC_ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `agw_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function generateAgentApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `agt_${raw}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function calculateMargin(costPrice: number, sellPrice: number): number {
  return sellPrice - costPrice;
}

export function calculateTokenCost(
  tokens: number,
  pricePerMillion: number,
): number {
  return (tokens / 1_000_000) * pricePerMillion;
}
