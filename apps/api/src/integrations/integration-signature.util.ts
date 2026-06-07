import { createHmac, timingSafeEqual } from 'crypto';

export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader?: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected = signWebhookPayload(secret, rawBody);
  const provided = signatureHeader.replace(/^sha256=/, '').trim();
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function generateWebhookSecret(): string {
  return createHmac('sha256', `${Date.now()}-${Math.random()}`).digest('hex');
}
