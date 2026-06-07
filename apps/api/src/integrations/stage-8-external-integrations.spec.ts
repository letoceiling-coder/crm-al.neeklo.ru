import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  OrganizationRole,
  UserRole,
  IntegrationProviderType,
  MessageDirection,
} from '@prisma/client';
import { IntegrationAccountService } from './integration-account.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { TelegramAdapter } from './providers/telegram.adapter';
import { MaxAdapter } from './providers/max.adapter';
import { EmailAdapter } from './providers/email.adapter';
import { WebhookAdapter } from './providers/webhook.adapter';
import { IntegrationEventService } from './integration-event.service';
import { AssistantChannelService } from './assistant-channel.service';
import { verifyWebhookSignature, signWebhookPayload } from './integration-signature.util';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

const tenant: TenantContext = {
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'u@test.io',
  role: UserRole.USER,
  organizationRole: OrganizationRole.OPERATOR,
};

describe('Stage 8 — External Integrations Platform', () => {
  describe('IntegrationAccountService — tenant isolation & secrets', () => {
    let service: IntegrationAccountService;
    const prisma = {
      integrationAccount: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      integrationProvider: { findUnique: jest.fn().mockResolvedValue({ id: 'int-prov-telegram' }) },
    };
    const secrets = {
      storeSecret: jest.fn().mockResolvedValue({ id: 'sec-1' }),
      updateSecret: jest.fn(),
      deleteSecret: jest.fn(),
      getSecret: jest.fn(),
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          IntegrationAccountService,
          { provide: PrismaService, useValue: prisma },
          { provide: SecretEncryptionService, useValue: secrets },
        ],
      }).compile();
      service = module.get(IntegrationAccountService);
    });

    it('lists accounts scoped to organization', async () => {
      prisma.integrationAccount.findMany.mockResolvedValue([]);
      await service.list(tenant);
      expect(prisma.integrationAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });

    it('rejects cross-tenant access', async () => {
      prisma.integrationAccount.findUnique.mockResolvedValue({ id: 'a1', organizationId: 'org-other' });
      await expect(service.assertOwned('a1', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('stores secret via EncryptedSecret on create', async () => {
      prisma.integrationAccount.create.mockResolvedValue({ id: 'acc-1' });
      await service.create(tenant, {
        provider: IntegrationProviderType.TELEGRAM,
        name: 'Bot',
        secret: 'token-123',
      });
      expect(secrets.storeSecret).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', plainValue: 'token-123' }),
      );
    });
  });

  describe('TelegramAdapter', () => {
    let adapter: TelegramAdapter;

    beforeEach(async () => {
      const module = await Test.createTestingModule({ providers: [TelegramAdapter] }).compile();
      adapter = module.get(TelegramAdapter);
    });

    it('parses text message', () => {
      const parsed = adapter.parseInbound({
        message: { chat: { id: 123 }, text: 'Hello', message_id: 1 },
      });
      expect(parsed?.externalId).toBe('123');
      expect(parsed?.workflowEvent).toBe('telegram.received');
      expect(parsed?.eventType).toBe('message');
    });

    it('parses command', () => {
      const parsed = adapter.parseInbound({
        message: {
          chat: { id: 1 },
          text: '/start',
          entities: [{ type: 'bot_command' }],
        },
      });
      expect(parsed?.eventType).toBe('command');
    });
  });

  describe('MaxAdapter', () => {
    let adapter: MaxAdapter;

    beforeEach(async () => {
      const module = await Test.createTestingModule({ providers: [MaxAdapter] }).compile();
      adapter = module.get(MaxAdapter);
    });

    it('parses message with attachments', () => {
      const parsed = adapter.parseInbound({
        message: { user_id: 'u1', text: 'Hi', attachments: [{ type: 'image' }] },
      });
      expect(parsed?.externalId).toBe('u1');
      expect(parsed?.workflowEvent).toBe('max.received');
      expect(parsed?.eventType).toBe('media');
    });
  });

  describe('EmailAdapter', () => {
    let adapter: EmailAdapter;

    beforeEach(async () => {
      const module = await Test.createTestingModule({ providers: [EmailAdapter] }).compile();
      adapter = module.get(EmailAdapter);
    });

    it('parses inbound email', () => {
      const parsed = adapter.parseInbound({
        from: 'client@example.com',
        subject: 'Question',
        text: 'Hello',
      });
      expect(parsed?.externalId).toBe('client@example.com');
      expect(parsed?.eventType).toBe('email.received');
      expect(parsed?.workflowEvent).toBe('email.received');
    });
  });

  describe('WebhookAdapter', () => {
    let adapter: WebhookAdapter;

    beforeEach(async () => {
      const module = await Test.createTestingModule({ providers: [WebhookAdapter] }).compile();
      adapter = module.get(WebhookAdapter);
    });

    it('parses generic webhook payload', () => {
      const parsed = adapter.parseInbound({ content: 'payload data', id: 'ext-1' });
      expect(parsed?.channel).toBe('WEBHOOK');
      expect(parsed?.workflowEvent).toBe('webhook.received');
    });
  });

  describe('Webhook signature', () => {
    it('signs and verifies payload', () => {
      const secret = 'test-secret';
      const body = '{"event":"test"}';
      const sig = signWebhookPayload(secret, body);
      expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
      expect(verifyWebhookSignature(secret, body, 'invalid')).toBe(false);
    });
  });

  describe('ConversationService — upsert', () => {
    let service: ConversationService;
    const prisma = {
      conversation: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
        update: jest.fn(),
      },
    };

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [ConversationService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = module.get(ConversationService);
    });

    it('creates new conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await service.upsert({
        organizationId: 'org-1',
        channel: 'TELEGRAM',
        externalId: '123',
      });
      expect(prisma.conversation.create).toHaveBeenCalled();
    });
  });

  describe('MessageService', () => {
    it('creates inbound message', async () => {
      const prisma = { message: { create: jest.fn().mockResolvedValue({ id: 'm1' }) } };
      const module = await Test.createTestingModule({
        providers: [MessageService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const service = module.get(MessageService);
      await service.create({
        conversationId: 'c1',
        direction: MessageDirection.INBOUND,
        content: 'Hi',
      });
      expect(prisma.message.create).toHaveBeenCalled();
    });
  });

  describe('IntegrationEventService — workflow emit', () => {
    it('records event and triggers workflow', async () => {
      const prisma = {
        integrationEvent: {
          create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
          update: jest.fn(),
        },
      };
      const workflows = { emitIntegrationEvent: jest.fn().mockResolvedValue([]) };
      const module = await Test.createTestingModule({
        providers: [
          IntegrationEventService,
          { provide: PrismaService, useValue: prisma },
          { provide: WorkflowTriggerService, useValue: workflows },
        ],
      }).compile();
      const service = module.get(IntegrationEventService);
      await service.record({
        organizationId: 'org-1',
        provider: IntegrationProviderType.TELEGRAM,
        accountId: 'acc-1',
        eventType: 'telegram.received',
        payload: { text: 'hello' },
      });
      expect(prisma.integrationEvent.create).toHaveBeenCalled();
      expect(workflows.emitIntegrationEvent).toHaveBeenCalledWith(
        'org-1',
        'telegram.received',
        expect.objectContaining({ eventId: 'ev-1' }),
      );
    });
  });

  describe('AssistantChannelService', () => {
    let service: AssistantChannelService;
    const prisma = {
      keyAgent: { findUnique: jest.fn().mockResolvedValue({ id: 'asst-1', organizationId: 'org-1' }) },
      assistantIntegrationChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: 'ch-1' }),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    const accounts = { assertOwned: jest.fn() };

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          AssistantChannelService,
          { provide: PrismaService, useValue: prisma },
          { provide: IntegrationAccountService, useValue: accounts },
        ],
      }).compile();
      service = module.get(AssistantChannelService);
    });

    it('binds assistant to integration account', async () => {
      await service.bind(tenant, 'asst-1', { integrationAccountId: 'acc-1' });
      expect(accounts.assertOwned).toHaveBeenCalledWith('acc-1', 'org-1');
      expect(prisma.assistantIntegrationChannel.upsert).toHaveBeenCalled();
    });
  });
});
