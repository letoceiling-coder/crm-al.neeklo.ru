import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import { IngestRunnerService } from './ingest-runner.service';
import { OrganizationRole, UserRole, KnowledgeDocumentFormat } from '@prisma/client';

describe('KnowledgeIngestService — async queue', () => {
  let service: KnowledgeIngestService;

  const orgId = 'org-a';
  const kbId = 'kb-1';
  const docId = 'doc-1';

  const prisma = {
    knowledgeDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const storage = {
    isConfigured: jest.fn().mockReturnValue(true),
    buildKey: jest.fn((...parts: string[]) => parts.join('/')),
    upload: jest.fn().mockResolvedValue({ key: 'raw/key' }),
  };

  const kb = { assertOwned: jest.fn().mockResolvedValue({ id: kbId }) };
  const stats = { refresh: jest.fn() };
  const limits = {
    assertCanCreateDocument: jest.fn(),
    assertCanCreateJob: jest.fn(),
    assertStorageWithinLimit: jest.fn(),
  };
  const queue = {
    enqueueIngestUrl: jest.fn().mockResolvedValue({ jobId: 'job-1', status: 'QUEUED' }),
    enqueueDocumentProcess: jest.fn().mockResolvedValue({ jobId: 'job-2', status: 'QUEUED' }),
    enqueueZipExtract: jest.fn().mockResolvedValue({ jobId: 'job-3', status: 'QUEUED' }),
    enqueueReprocess: jest.fn().mockResolvedValue({ jobId: 'job-4', status: 'QUEUED' }),
  };
  const runner = {
    runManualText: jest.fn().mockResolvedValue(undefined),
  };

  const tenant = {
    userId: 'u1',
    email: 'a@test.com',
    role: UserRole.USER,
    organizationId: orgId,
    organizationRole: OrganizationRole.OWNER,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeIngestService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: KnowledgeBaseService, useValue: kb },
        { provide: KnowledgeStatsService, useValue: stats },
        { provide: KnowledgePlanLimitsService, useValue: limits },
        { provide: KnowledgeQueueService, useValue: queue },
        { provide: IngestRunnerService, useValue: runner },
      ],
    }).compile();
    service = module.get(KnowledgeIngestService);
  });

  it('queueUrlIngest returns QUEUED without waiting for parser', async () => {
    prisma.knowledgeDocument.create.mockResolvedValue({ id: docId });

    const result = await service.queueUrlIngest(tenant, kbId, 'https://example.com/page');

    expect(result).toEqual({ jobId: 'job-1', status: 'QUEUED' });
    expect(queue.enqueueIngestUrl).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: docId, url: 'https://example.com/page' }),
    );
    expect(limits.assertCanCreateJob).toHaveBeenCalled();
  });

  it('queueFileUpload routes ZIP to zip extract queue', async () => {
    prisma.knowledgeDocument.create.mockResolvedValue({ id: docId, format: KnowledgeDocumentFormat.ZIP });

    const file = {
      buffer: Buffer.from('zip'),
      originalname: 'archive.zip',
      mimetype: 'application/zip',
      size: 100,
    };

    const result = await service.queueFileUpload(tenant, kbId, file);

    expect(result).toEqual({ jobId: 'job-3', status: 'QUEUED' });
    expect(queue.enqueueZipExtract).toHaveBeenCalled();
    expect(queue.enqueueDocumentProcess).not.toHaveBeenCalled();
  });

  it('reprocessDocument enqueues reprocess job', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: docId,
      organizationId: orgId,
      knowledgeBaseId: kbId,
      sourceUrl: 'https://example.com',
    });

    const result = await service.reprocessDocument(tenant, docId);

    expect(result).toEqual({ jobId: 'job-4', status: 'QUEUED' });
    expect(queue.enqueueReprocess).toHaveBeenCalled();
  });
});
