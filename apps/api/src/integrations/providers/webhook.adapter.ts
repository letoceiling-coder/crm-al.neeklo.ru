import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class WebhookAdapter {
  parseInbound(
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ): ParsedInboundMessage | null {
    const externalId = String(
      payload.externalId ?? payload.id ?? headers?.['x-external-id'] ?? 'webhook',
    );
    const content = String(payload.content ?? payload.message ?? JSON.stringify(payload));

    return {
      externalId,
      channel: 'WEBHOOK',
      content,
      eventType: 'webhook.received',
      workflowEvent: 'webhook.received',
      metadata: { headers, payload },
    };
  }

  async sendOutbound(
    settings: Record<string, unknown>,
    secret: string | null,
    body: Record<string, unknown>,
    method = 'POST',
  ) {
    const url = String(settings.outboundUrl ?? settings.url ?? '');
    if (!url) throw new Error('Outbound webhook URL not configured');

    const raw = JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) {
      const { signWebhookPayload } = await import('../integration-signature.util');
      headers['X-Signature'] = `sha256=${signWebhookPayload(secret, raw)}`;
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: ['GET', 'HEAD'].includes(method) ? undefined : raw,
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) return { status: res.status, attempt: attempt + 1 };
        lastError = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    throw lastError ?? new Error('Webhook delivery failed');
  }
}
