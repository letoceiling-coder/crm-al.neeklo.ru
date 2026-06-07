import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class TelegramAdapter {
  parseInbound(payload: Record<string, unknown>): ParsedInboundMessage | null {
    const msg = (payload.message ?? payload.edited_message) as Record<string, unknown> | undefined;
    const cb = payload.callback_query as Record<string, unknown> | undefined;

    if (cb) {
      const from = cb.from as { id?: number } | undefined;
      return {
        externalId: String(from?.id ?? cb.id ?? 'unknown'),
        channel: 'TELEGRAM',
        content: String(cb.data ?? 'callback'),
        eventType: 'callback_query',
        workflowEvent: 'telegram.received',
        metadata: { callback: cb },
      };
    }

    if (!msg) return null;

    const chat = msg.chat as { id?: number } | undefined;
    const text = String(msg.text ?? msg.caption ?? '');
    const entities = msg.entities as Array<{ type?: string }> | undefined;
    const isCommand = entities?.some((e) => e.type === 'bot_command') || text.startsWith('/');

    const attachments: unknown[] = [];
    if (msg.photo) attachments.push({ type: 'photo', data: msg.photo });
    if (msg.document) attachments.push({ type: 'document', data: msg.document });
    if (msg.voice) attachments.push({ type: 'voice', data: msg.voice });

    return {
      externalId: String(chat?.id ?? msg.from ?? 'unknown'),
      channel: 'TELEGRAM',
      content: text || '[media]',
      eventType: attachments.length ? 'media' : isCommand ? 'command' : 'message',
      workflowEvent: 'telegram.received',
      attachments,
      metadata: { messageId: msg.message_id, from: msg.from },
    };
  }

  async sendMessage(botToken: string | null, chatId: string, text: string) {
    if (!botToken) return { ok: false, error: 'No bot token' };
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Telegram API: ${JSON.stringify(body)}`);
    return body;
  }
}
