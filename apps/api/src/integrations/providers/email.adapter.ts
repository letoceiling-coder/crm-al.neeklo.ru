import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class EmailAdapter {
  parseInbound(payload: Record<string, unknown>): ParsedInboundMessage | null {
    const from = String(payload.from ?? payload.sender ?? 'unknown@local');
    const subject = String(payload.subject ?? '');
    const body = String(payload.text ?? payload.body ?? payload.content ?? '');
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    return {
      externalId: from,
      channel: 'EMAIL',
      content: subject ? `${subject}\n\n${body}` : body,
      eventType: 'email.received',
      workflowEvent: 'email.received',
      attachments,
      metadata: { from, subject, to: payload.to },
    };
  }

  async sendMessage(
    settings: Record<string, unknown>,
    secret: string | null,
    to: string,
    text: string,
  ) {
    const relayUrl = String(settings.smtpRelayUrl ?? '');
    if (relayUrl) {
      const res = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({
          to,
          from: settings.fromAddress ?? 'noreply@platform.local',
          subject: settings.defaultSubject ?? 'Message from AI Gateway',
          text,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Email relay HTTP ${res.status}`);
      return { ok: true, eventType: 'email.sent' };
    }
    return { queued: true, to, eventType: 'email.sent', message: 'Configure smtpRelayUrl in account settings' };
  }
}
