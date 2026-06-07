import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class Bitrix24Adapter {
  parseInbound(payload: Record<string, unknown>): ParsedInboundMessage | null {
    const event = String(payload.event ?? payload.EVENT ?? 'unknown');
    const data = (payload.data ?? payload.DATA ?? payload) as Record<string, unknown>;

    const map: Record<string, string> = {
      ONCRMLEADADD: 'bitrix.lead.created',
      ONCRMDEALADD: 'bitrix.deal.created',
      ONCRMCONTACTADD: 'bitrix.contact.created',
      ONTASKADD: 'bitrix.task.created',
    };

    const workflowEvent = map[event] ?? 'webhook.received';
    const entityId = String(data.ID ?? data.id ?? event);

    return {
      externalId: entityId,
      channel: 'WEBHOOK',
      content: `Bitrix24 event: ${event}`,
      eventType: event,
      workflowEvent,
      metadata: { event, data },
    };
  }

  getOAuthUrl(settings: Record<string, unknown>, redirectUri: string): string {
    const domain = String(settings.domain ?? '');
    const clientId = String(settings.clientId ?? '');
    return `https://${domain}/oauth/authorize/?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
