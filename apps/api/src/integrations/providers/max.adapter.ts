import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class MaxAdapter {
  parseInbound(payload: Record<string, unknown>): ParsedInboundMessage | null {
    const msg = (payload.message ?? payload) as Record<string, unknown>;
    const userId = String(msg.user_id ?? msg.sender_id ?? msg.chat_id ?? 'unknown');
    const text = String(msg.text ?? msg.body ?? '');
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

    return {
      externalId: userId,
      channel: 'MAX',
      content: text || (attachments.length ? '[attachment]' : ''),
      eventType: attachments.length ? 'media' : 'message',
      workflowEvent: 'max.received',
      attachments,
      metadata: { raw: msg },
    };
  }

  async sendMessage(
    apiKey: string | null,
    userId: string,
    text: string,
    settings: Record<string, unknown>,
  ) {
    const apiUrl = String(settings.apiUrl ?? 'https://api.max.ru/bot');
    if (!apiKey) return { ok: false, error: 'No API key' };
    const res = await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ user_id: userId, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`MAX API HTTP ${res.status}`);
    return res.json();
  }
}
