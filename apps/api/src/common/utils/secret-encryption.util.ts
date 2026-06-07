import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function secretKey(): Buffer {
  const secret = process.env.SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('SECRET_ENCRYPTION_KEY is not configured');
  }
  return createHash('sha256').update(secret).digest();
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptSecret(plain: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const enc = Buffer.from(payload.ciphertext, 'base64');
  const decipher = createDecipheriv(ALGO, secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
