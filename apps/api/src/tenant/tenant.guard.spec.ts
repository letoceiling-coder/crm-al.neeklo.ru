import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole, UserRole } from '@prisma/client';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let prisma: {
    user: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
  };

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get(TenantGuard);
  });

  function mockContext(request: Record<string, unknown>) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;
  }

  it('rejects organizationId override in request body', async () => {
    const request = {
      user: {
        id: 'user1',
        email: 'a@test.com',
        role: UserRole.USER,
        organizationId: 'org-a',
        organizationRole: OrganizationRole.OWNER,
      },
      body: { organizationId: 'org-b' },
    };

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('sets tenantContext from JWT user', async () => {
    const request = {
      user: {
        id: 'user1',
        email: 'a@test.com',
        role: UserRole.USER,
        organizationId: 'org-a',
        organizationRole: OrganizationRole.OWNER,
      },
      body: {},
    };

    const ok = await guard.canActivate(mockContext(request));
    expect(ok).toBe(true);
    expect(request).toHaveProperty('tenantContext');
    expect((request as unknown as { tenantContext: { organizationId: string } }).tenantContext.organizationId).toBe('org-a');
  });

  it('sets tenantContext from apiKey organizationId', async () => {
    const request = {
      user: {
        id: 'user1',
        email: 'a@test.com',
        role: UserRole.USER,
      },
      apiKey: { organizationId: 'org-from-key' },
      body: {},
    };

    const ok = await guard.canActivate(mockContext(request));
    expect(ok).toBe(true);
    expect((request as unknown as { tenantContext: { organizationId: string } }).tenantContext.organizationId).toBe(
      'org-from-key',
    );
  });

  it('resolves organization from database when missing in JWT', async () => {
    prisma.user.findUnique.mockResolvedValue({ activeOrganizationId: 'org-db' });
    prisma.organizationMember.findUnique.mockResolvedValue({ role: OrganizationRole.ADMIN });

    const request = {
      user: {
        id: 'user1',
        email: 'a@test.com',
        role: UserRole.USER,
      },
      body: {},
    };

    const ok = await guard.canActivate(mockContext(request));
    expect(ok).toBe(true);
    expect((request as unknown as { tenantContext: { organizationId: string } }).tenantContext.organizationId).toBe('org-db');
  });
});
