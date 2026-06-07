export type IntegrationProviderType =
  | 'TELEGRAM'
  | 'MAX'
  | 'EMAIL'
  | 'WEBHOOK'
  | 'BITRIX24'
  | 'AMOCRM'
  | 'GOOGLE'
  | 'CUSTOM';

export type IntegrationAccountStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING';
export type ConversationChannel = 'TELEGRAM' | 'MAX' | 'EMAIL' | 'WEBHOOK';
export type ConversationStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface IntegrationProvider {
  id: string;
  provider: IntegrationProviderType;
  name: string;
  description?: string | null;
}

export interface IntegrationAccount {
  id: string;
  name: string;
  provider: IntegrationProviderType;
  status: IntegrationAccountStatus;
  settings: Record<string, unknown>;
  webhookSecret?: string | null;
  lastSyncAt?: string | null;
  updatedAt: string;
  providerRef?: { name: string; provider: IntegrationProviderType };
  _count?: { channels: number; conversations: number };
}

export interface AssistantChannel {
  id: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  integrationAccount: IntegrationAccount & { providerRef?: IntegrationProvider };
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  externalId: string;
  status: ConversationStatus;
  lastMessageAt?: string | null;
  assistant?: { id: string; name: string } | null;
  integrationAccount?: { id: string; name: string; provider: IntegrationProviderType } | null;
  messages?: Message[];
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'SYSTEM';
  content: string;
  attachments: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const PROVIDER_LABELS: Record<IntegrationProviderType, string> = {
  TELEGRAM: 'Telegram',
  MAX: 'MAX',
  EMAIL: 'Email',
  WEBHOOK: 'Webhook',
  BITRIX24: 'Bitrix24',
  AMOCRM: 'amoCRM',
  GOOGLE: 'Google',
  CUSTOM: 'Custom',
};

export const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  TELEGRAM: 'Telegram',
  MAX: 'MAX',
  EMAIL: 'Email',
  WEBHOOK: 'Webhook',
};

export const STATUS_LABELS: Record<IntegrationAccountStatus, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  ERROR: 'Ошибка',
  PENDING: 'Ожидание',
};
