import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SystemQueueService } from './system-queue.service';
import { SystemCostAnomalyService } from './system-cost-anomaly.service';
import { SystemRateLimitService } from './system-rate-limit.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import {
  shouldRunKnowledgeWorkers,
  shouldRunWorkflowWorkers,
  isApiProcess,
} from '../config/app-role';

describe('Stage 10 — Enterprise Scale Platform', () => {
  const originalRole = process.env.APP_ROLE;

  afterEach(() => {
    process.env.APP_ROLE = originalRole;
  });

  describe('Worker separation', () => {
    it('api process excludes knowledge workers by default', () => {
      process.env.APP_ROLE = 'api';
      expect(isApiProcess()).toBe(true);
      expect(shouldRunKnowledgeWorkers()).toBe(false);
      expect(shouldRunWorkflowWorkers()).toBe(false);
    });

    it('worker-knowledge enables knowledge processors only', () => {
      process.env.APP_ROLE = 'worker-knowledge';
      expect(shouldRunKnowledgeWorkers()).toBe(true);
      expect(shouldRunWorkflowWorkers()).toBe(false);
    });
  });

  describe('AdminGuard', () => {
    it('blocks non-admin', () => {
      const guard = new AdminGuard();
      expect(() =>
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.USER } }) }),
        } as never),
      ).toThrow(ForbiddenException);
    });
  });

  describe('SystemQueueService', () => {
    it('returns metrics for monitored queues', async () => {
      const mockQueue = {
        getWaitingCount: jest.fn().mockResolvedValue(1),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(10),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
        isPaused: jest.fn().mockResolvedValue(false),
        getWaiting: jest.fn().mockResolvedValue([]),
        client: Promise.resolve({ status: 'ready' }),
      };
      const queues = Object.fromEntries(
        [
          QUEUE_NAMES.KNOWLEDGE_INGEST,
          QUEUE_NAMES.KNOWLEDGE_CHUNK,
          QUEUE_NAMES.KNOWLEDGE_EMBED,
          QUEUE_NAMES.KNOWLEDGE_REEMBED,
          QUEUE_NAMES.MEMORY_SUMMARIZE,
          QUEUE_NAMES.WORKFLOW_RUN,
          QUEUE_NAMES.WORKFLOW_RETRY,
          QUEUE_NAMES.WORKFLOW_DLQ,
          QUEUE_NAMES.INTEGRATION_EVENTS,
          QUEUE_NAMES.TOOL_EXECUTION,
        ].map((name) => [name, mockQueue]),
      );

      const module = await Test.createTestingModule({
        providers: [
          SystemQueueService,
          { provide: `BullQueue_${QUEUE_NAMES.KNOWLEDGE_INGEST}`, useValue: queues[QUEUE_NAMES.KNOWLEDGE_INGEST] },
          { provide: `BullQueue_${QUEUE_NAMES.KNOWLEDGE_CHUNK}`, useValue: queues[QUEUE_NAMES.KNOWLEDGE_CHUNK] },
          { provide: `BullQueue_${QUEUE_NAMES.KNOWLEDGE_EMBED}`, useValue: queues[QUEUE_NAMES.KNOWLEDGE_EMBED] },
          { provide: `BullQueue_${QUEUE_NAMES.KNOWLEDGE_REEMBED}`, useValue: queues[QUEUE_NAMES.KNOWLEDGE_REEMBED] },
          { provide: `BullQueue_${QUEUE_NAMES.MEMORY_SUMMARIZE}`, useValue: queues[QUEUE_NAMES.MEMORY_SUMMARIZE] },
          { provide: `BullQueue_${QUEUE_NAMES.WORKFLOW_RUN}`, useValue: queues[QUEUE_NAMES.WORKFLOW_RUN] },
          { provide: `BullQueue_${QUEUE_NAMES.WORKFLOW_RETRY}`, useValue: queues[QUEUE_NAMES.WORKFLOW_RETRY] },
          { provide: `BullQueue_${QUEUE_NAMES.WORKFLOW_DLQ}`, useValue: queues[QUEUE_NAMES.WORKFLOW_DLQ] },
          { provide: `BullQueue_${QUEUE_NAMES.INTEGRATION_EVENTS}`, useValue: queues[QUEUE_NAMES.INTEGRATION_EVENTS] },
          { provide: `BullQueue_${QUEUE_NAMES.TOOL_EXECUTION}`, useValue: queues[QUEUE_NAMES.TOOL_EXECUTION] },
        ],
      }).compile();

      const service = module.get(SystemQueueService);
      const result = await service.getQueueMetrics();
      expect(result.redis).toBe(true);
      expect(result.queues.length).toBe(10);
    });
  });

  describe('RedisCacheService', () => {
    it('returns zero stats when redis unavailable', async () => {
      const cache = Object.create(RedisCacheService.prototype) as RedisCacheService;
      Object.assign(cache, { client: null, defaultTtlSec: 300 });
      const stats = await cache.getStats('retrieval');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('SystemCostAnomalyService', () => {
    it('detects platform spike', async () => {
      const prisma = {
        usageLog: {
          groupBy: jest.fn().mockResolvedValue([]),
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { totalTokens: 1_000_000, userCost: 500 } })
            .mockResolvedValueOnce({ _sum: { totalTokens: 100_000, userCost: 50 } }),
        },
      };
      const module = await Test.createTestingModule({
        providers: [SystemCostAnomalyService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const service = module.get(SystemCostAnomalyService);
      const anomalies = await service.detect();
      expect(anomalies.some((a) => a.type === 'spike')).toBe(true);
    });
  });

  describe('SystemRateLimitService', () => {
    it('reads org rpm from plan limits', async () => {
      const prisma = { planLimits: { findUnique: jest.fn().mockResolvedValue({ rpm: 200 }) } };
      const cache = { buildKey: (...p: string[]) => p.join(':'), incr: jest.fn().mockResolvedValue(1) };
      const module = await Test.createTestingModule({
        providers: [
          SystemRateLimitService,
          { provide: PrismaService, useValue: prisma },
          { provide: RedisCacheService, useValue: cache },
        ],
      }).compile();
      const service = module.get(SystemRateLimitService);
      const limits = await service.getOrganizationLimits('org-1');
      expect(limits.rpm).toBe(200);
    });
  });
});
