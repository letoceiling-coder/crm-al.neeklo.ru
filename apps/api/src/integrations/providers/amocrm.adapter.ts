import { Injectable } from '@nestjs/common';
import { ParsedInboundMessage } from '../integration.constants';

@Injectable()
export class AmoCrmAdapter {
  parseInbound(payload: Record<string, unknown>): ParsedInboundMessage | null {
    const leads = payload.leads as { add?: unknown[] } | undefined;
    const contacts = payload.contacts as { add?: unknown[] } | undefined;
    const tasks = payload.tasks as { add?: unknown[] } | undefined;

    if (leads?.add?.length) {
      const item = leads.add[0] as Record<string, unknown>;
      return {
        externalId: String(item.id ?? 'lead'),
        channel: 'WEBHOOK',
        content: `amoCRM lead created: ${item.name ?? item.id}`,
        eventType: 'lead.add',
        workflowEvent: 'amo.lead.created',
        metadata: { lead: item },
      };
    }
    if (contacts?.add?.length) {
      const item = contacts.add[0] as Record<string, unknown>;
      return {
        externalId: String(item.id ?? 'contact'),
        channel: 'WEBHOOK',
        content: `amoCRM contact created: ${item.name ?? item.id}`,
        eventType: 'contact.add',
        workflowEvent: 'amo.contact.created',
        metadata: { contact: item },
      };
    }
    if (tasks?.add?.length) {
      const item = tasks.add[0] as Record<string, unknown>;
      return {
        externalId: String(item.id ?? 'task'),
        channel: 'WEBHOOK',
        content: `amoCRM task created: ${item.text ?? item.id}`,
        eventType: 'task.add',
        workflowEvent: 'amo.task.created',
        metadata: { task: item },
      };
    }

    return {
      externalId: 'amo-webhook',
      channel: 'WEBHOOK',
      content: JSON.stringify(payload),
      eventType: 'webhook',
      workflowEvent: 'webhook.received',
      metadata: payload,
    };
  }

  getOAuthUrl(settings: Record<string, unknown>, redirectUri: string): string {
    const subdomain = String(settings.subdomain ?? '');
    const clientId = String(settings.clientId ?? '');
    return `https://${subdomain}.amocrm.ru/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  }
}
