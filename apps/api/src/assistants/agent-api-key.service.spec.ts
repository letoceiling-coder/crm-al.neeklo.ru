import { Test, TestingModule } from '@nestjs/testing';
import { AgentApiKeyService } from './agent-api-key.service';
import { KeyAgentService } from './key-agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyStatus, OrganizationRole, UserRole } from '@prisma/client';

jest.mock('../common/utils/crypto.util', () => ({
  generateAgentApiKey: jest.fn(() => ({
    key: 'agt_rotated',
    prefix: 'agt_rotated',
    hash: 'hash-rotated',
  })),
  encryptApiKey: jest.fn((k: string) => `enc:${k}`),
  decryptApiKey: jest.fn((e: string) => e.replace('enc:', '')),
}));

describe('AgentApiKeyService — rotation', () => {
  let service: AgentApiKeyService;

  const tenant = {
    userId: 'user-1',
    email: 'a@test.com',
    role: UserRole.USER,
    organizationId: 'org-a',
    organizationRole: OrganizationRole.OWNER,
  };

  const existingKey = {
    id: 'key-1',
    keyAgentId: 'agent-1',
    apiKeyId: 'agw-1',
    name: 'Prod',
    keyHash: 'hash1',
    keyPrefix: 'agt_first',
    keyEncrypted: 'enc:agt_first',
    status: ApiKeyStatus.ACTIVE,
  };

  const prisma = {
    agentApiKey: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    apiKey: { findUnique: jest.fn() },
    planLimits: { findUnique: jest.fn().mockResolvedValue({ maxAgentApiKeys: 20 }) },
  };

  const keyAgents = {
    assertOwned: jest.fn().mockResolvedValue({ id: 'agent-1', organizationId: 'org-a' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentApiKeyService,
        { provide: PrismaService, useValue: prisma },
        { provide: KeyAgentService, useValue: keyAgents },
      ],
    }).compile();
    service = module.get(AgentApiKeyService);
  });

  it('rotates key hash and returns new plaintext once', async () => {
    prisma.agentApiKey.findUnique.mockResolvedValue(existingKey);
    prisma.agentApiKey.update.mockResolvedValue({
      ...existingKey,
      keyHash: 'hash-rotated',
      keyPrefix: 'agt_rotated',
      keyEncrypted: 'enc:agt_rotated',
    });

    const result = await service.rotate(tenant, 'agent-1', 'key-1', {});

    expect(result.key).toBe('agt_rotated');
    expect(prisma.agentApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keyHash: 'hash-rotated',
          status: ApiKeyStatus.ACTIVE,
          revokedAt: null,
        }),
      }),
    );
  });

  it('revokes key and sets inactive status', async () => {
    prisma.agentApiKey.findUnique.mockResolvedValue(existingKey);
    prisma.agentApiKey.update.mockResolvedValue({
      ...existingKey,
      status: ApiKeyStatus.INACTIVE,
      revokedAt: new Date('2026-01-01'),
    });

    const result = await service.revoke(tenant, 'agent-1', 'key-1');
    expect(result.status).toBe(ApiKeyStatus.INACTIVE);
    expect(prisma.agentApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ApiKeyStatus.INACTIVE }),
      }),
    );
  });
});
