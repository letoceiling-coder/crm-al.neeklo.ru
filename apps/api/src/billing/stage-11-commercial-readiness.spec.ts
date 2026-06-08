import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole, UserRole } from '@prisma/client';
import { BillingPlanService } from './billing.service';
import { SystemRateLimitService } from '../system/system-rate-limit.service';
import { ExportService } from '../exports/export.service';
import { OrganizationMembersService } from '../organizations/organization-members.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

describe('Stage 11 — Commercial Readiness', () => {
  describe('BillingPlanService', () => {
    it('lists active plans', async () => {
      const prisma = {
        billingPlan: { findMany: jest.fn().mockResolvedValue([{ tier: 'FREE' }, { tier: 'PRO' }]) },
      };
      const mod = await Test.createTestingModule({
        providers: [BillingPlanService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const plans = await mod.get(BillingPlanService).listPlans();
      expect(plans).toHaveLength(2);
    });
  });

  describe('SystemRateLimitService — plan enforcement', () => {
    it('throws 429 when rpm exceeded', async () => {
      const cache = {
        buildKey: (...p: string[]) => p.join(':'),
        incr: jest
          .fn()
          .mockResolvedValueOnce(121)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1),
        getCounter: jest.fn(),
        incrBy: jest.fn(),
      };
      const prisma = {
        planLimits: {
          findUnique: jest.fn().mockResolvedValue({
            rpm: 120,
            dailyRequests: 10000,
            monthlyRequests: 300000,
            monthlyTokens: BigInt(1e7),
            monthlyStorageMb: 5120,
          }),
        },
        usageAggregate: { upsert: jest.fn().mockResolvedValue({}) },
      };
      const mod = await Test.createTestingModule({
        providers: [
          SystemRateLimitService,
          { provide: PrismaService, useValue: prisma },
          { provide: RedisCacheService, useValue: cache },
        ],
      }).compile();
      await expect(mod.get(SystemRateLimitService).assertOrganizationLimits('org-1')).rejects.toMatchObject({
        status: 429,
      });
    });
  });

  describe('ExportService', () => {
    it('exports usage csv', async () => {
      const prisma = { usageLog: { findMany: jest.fn().mockResolvedValue([]) } };
      const mod = await Test.createTestingModule({
        providers: [ExportService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const file = await mod.get(ExportService).exportUsage(
        {
          organizationId: 'o1',
          userId: 'u1',
          organizationRole: OrganizationRole.OWNER,
          email: 'a@b.c',
          role: UserRole.USER,
        },
        'csv',
      );
      expect(file.filename).toBe('usage.csv');
    });
  });

  describe('OrganizationMembersService', () => {
    it('requires admin to invite', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          OrganizationMembersService,
          { provide: PrismaService, useValue: {} },
          { provide: EmailService, useValue: { sendOrganizationInvitation: jest.fn() } },
          { provide: ConfigService, useValue: { get: () => 'http://localhost' } },
        ],
      }).compile();
      await expect(
        mod.get(OrganizationMembersService).invite(
          {
            userId: 'u',
            organizationId: 'o',
            organizationRole: OrganizationRole.OPERATOR,
            email: 'x@y.z',
            role: UserRole.USER,
          },
          'new@test.com',
          OrganizationRole.OPERATOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
