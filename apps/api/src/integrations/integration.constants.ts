export const INTEGRATION_WORKFLOW_EVENTS = [
  'message.received',
  'email.received',
  'email.sent',
  'telegram.received',
  'max.received',
  'webhook.received',
  'bitrix.lead.created',
  'bitrix.deal.created',
  'bitrix.contact.created',
  'bitrix.task.created',
  'amo.lead.created',
  'amo.contact.created',
  'amo.task.created',
] as const;

export const TELEGRAM_EVENTS = ['message', 'command', 'callback_query', 'media'] as const;

export const PROVIDER_ID_MAP: Record<string, string> = {
  TELEGRAM: 'int-prov-telegram',
  MAX: 'int-prov-max',
  EMAIL: 'int-prov-email',
  WEBHOOK: 'int-prov-webhook',
  BITRIX24: 'int-prov-bitrix24',
  AMOCRM: 'int-prov-amocrm',
  GOOGLE: 'int-prov-google',
  CUSTOM: 'int-prov-custom',
};

export interface ParsedInboundMessage {
  externalId: string;
  channel: 'TELEGRAM' | 'MAX' | 'EMAIL' | 'WEBHOOK';
  content: string;
  eventType: string;
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
  workflowEvent?: string;
}

export const INTEGRATION_RETRY_ATTEMPTS = 3;
export const INTEGRATION_RETRY_BACKOFF_MS = [2000, 10000, 30000];
