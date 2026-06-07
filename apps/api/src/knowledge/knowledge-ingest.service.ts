import { Injectable, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { passManualTextGate } from './knowledge-quality.gate';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
} from '@prisma/client';
import { formatFromMime, type UploadedFilePayload } from './knowledge.utils';
import { randomUUID } from 'crypto';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { IngestRunnerService } from './ingest-runner.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';

@Injectable()
export class KnowledgeIngestService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private kb: KnowledgeBaseService,
    private limits: KnowledgePlanLimitsService,
    private queue: KnowledgeQueueService,
    private stats: KnowledgeStatsService,
    private runner: IngestRunnerService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async queueUrlIngest(
    tenant: TenantContext,
    knowledgeBaseId: string,
    url: string,
    title?: string,
    knowledgeSourceId?: string,
    parserModeOverride?: string | null,
  ) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    await this.limits.assertCanCreateDocument(tenant.organizationId, knowledgeBaseId);
    await this.limits.assertCanCreateJob(tenant.organizationId);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId,
        knowledgeSourceId,
        title: title ?? url,
        format: KnowledgeDocumentFormat.URL,
        sourceUrl: url,
        status: KnowledgeDocumentStatus.PENDING,
      },
    });

    void this.workflowTriggers?.emitKbEvent(tenant.organizationId, 'DOCUMENT_CREATED', {
      documentId: doc.id,
      knowledgeBaseId,
      format: doc.format,
    });

    return this.queue.enqueueIngestUrl({
      organizationId: tenant.organizationId,
      knowledgeBaseId,
      documentId: doc.id,
      url,
      knowledgeSourceId,
      parserModeOverride,
    });
  }

  async ingestManualText(
    tenant: TenantContext,
    knowledgeBaseId: string,
    title: string,
    text: string,
  ) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    const gate = passManualTextGate(text);
    if (!gate.pass) throw new BadRequestException('Text too short (minimum 50 characters)');

    await this.limits.assertCanCreateDocument(tenant.organizationId, knowledgeBaseId);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId,
        title,
        format: KnowledgeDocumentFormat.MANUAL,
        status: KnowledgeDocumentStatus.PROCESSING,
      },
    });

    void this.workflowTriggers?.emitKbEvent(tenant.organizationId, 'DOCUMENT_CREATED', {
      documentId: doc.id,
      knowledgeBaseId,
      format: doc.format,
    });

    await this.runner.runManualText(
      tenant.organizationId,
      knowledgeBaseId,
      doc.id,
      text,
    );

    return this.prisma.knowledgeDocument.findUnique({
      where: { id: doc.id },
      include: { versions: true },
    });
  }

  async queueFileUpload(
    tenant: TenantContext,
    knowledgeBaseId: string,
    file: UploadedFilePayload,
    title?: string,
  ) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');
    if (!this.storage.isConfigured()) throw new BadRequestException('S3 not configured');

    await this.limits.assertCanCreateDocument(tenant.organizationId, knowledgeBaseId);
    await this.limits.assertStorageWithinLimit(tenant.organizationId, file.size);

    const formatStr = formatFromMime(file.mimetype, file.originalname);
    const format = formatStr as KnowledgeDocumentFormat;
    const docId = randomUUID();
    const rawKey = this.storage.buildKey(
      tenant.organizationId,
      'raw',
      knowledgeBaseId,
      docId,
      file.originalname,
    );

    await this.storage.upload({
      key: rawKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        id: docId,
        organizationId: tenant.organizationId,
        knowledgeBaseId,
        title: title ?? file.originalname,
        format,
        status: KnowledgeDocumentStatus.PENDING,
        rawS3Key: rawKey,
      },
    });

    void this.workflowTriggers?.emitKbEvent(tenant.organizationId, 'DOCUMENT_CREATED', {
      documentId: doc.id,
      knowledgeBaseId,
      format: doc.format,
    });

    if (format === KnowledgeDocumentFormat.ZIP) {
      return this.queue.enqueueZipExtract({
        organizationId: tenant.organizationId,
        knowledgeBaseId,
        documentId: doc.id,
        rawS3Key: rawKey,
      });
    }

    return this.queue.enqueueDocumentProcess({
      organizationId: tenant.organizationId,
      knowledgeBaseId,
      documentId: doc.id,
    });
  }

  async reprocessDocument(tenant: TenantContext, documentId: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.organizationId !== tenant.organizationId) {
      throw new BadRequestException('Document not found');
    }
    return this.queue.enqueueReprocess({
      organizationId: tenant.organizationId,
      knowledgeBaseId: doc.knowledgeBaseId,
      documentId: doc.id,
      url: doc.sourceUrl ?? undefined,
    });
  }

  async reembedDocument(tenant: TenantContext, knowledgeBaseId: string, documentId: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.queue.enqueueReembed({
      organizationId: tenant.organizationId,
      knowledgeBaseId,
      documentId,
    });
  }
}
