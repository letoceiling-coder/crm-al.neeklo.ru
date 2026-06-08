import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ParserClientService } from '../parser-client/parser-client.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { DomainProfileService } from './domain-profile.service';
import {
  passUrlQualityGate,
  passDocumentQualityGate,
  passManualTextGate,
} from './knowledge-quality.gate';
import { URL_PARSER_MODE, extractDomain } from './knowledge.utils';
import {
  CrawlStatus,
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  KnowledgeJobStatus,
} from '@prisma/client';
import type {
  IngestUrlJobPayload,
  DocumentProcessJobPayload,
  ZipExtractJobPayload,
  ReprocessJobPayload,
} from './jobs/knowledge-job.types';
import { KnowledgeJobService } from './jobs/knowledge-job.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import { ZipExtractionService } from './domain/zip-extraction.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { AlertingService } from '../alerting/alerting.service';

export type ProcessUrlResult = 'SUCCESS' | 'FAILED' | 'SKIPPED';

@Injectable()
export class IngestRunnerService {
  private readonly logger = new Logger(IngestRunnerService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private parser: ParserClientService,
    private stats: KnowledgeStatsService,
    private domainProfile: DomainProfileService,
    private jobs: KnowledgeJobService,
    private zipExtract: ZipExtractionService,
    private queue: KnowledgeQueueService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
    @Optional() private alerting?: AlertingService,
  ) {}

  async runIngestUrl(payload: IngestUrlJobPayload): Promise<ProcessUrlResult> {
    const { jobId, documentId, url, knowledgeSourceId, organizationId, knowledgeBaseId } =
      payload;

    await this.jobs.markRunning(jobId);

    const domain = extractDomain(url);
    const mode = URL_PARSER_MODE;

    try {
      if (knowledgeSourceId) {
        await this.updateSourceRunState(knowledgeSourceId, {
          crawlStatus: CrawlStatus.ACTIVE,
          progress: 5,
          lastRunAt: new Date(),
        });
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: KnowledgeDocumentStatus.PROCESSING },
      });

      if (knowledgeSourceId) {
        await this.updateSourceRunState(knowledgeSourceId, { progress: 15 });
      }

      const result = await this.parser.parseAndWait({ url, mode, async: true });
      const gate = passUrlQualityGate(result);
      const parserJobId = typeof result.id === 'string' ? result.id : undefined;

      if (domain) {
        await this.domainProfile.recordParseResult(domain, result, gate.pass);
      }

      if (!gate.pass) {
        const status =
          gate.reason === 'quality_gate'
            ? KnowledgeDocumentStatus.SKIPPED_QUALITY
            : KnowledgeDocumentStatus.FAILED;
        await this.prisma.knowledgeDocument.update({
          where: { id: documentId },
          data: {
            status,
            parserJobId,
            okContent: result.okContent ?? false,
            contentValidation: result.contentValidation as object | undefined,
            parserChars: result.chars ?? 0,
            parserWarnings: result.warnings as object | undefined,
          },
        });
        if (knowledgeSourceId) {
          await this.updateSourceStats(knowledgeSourceId, false, result.okContent);
          await this.updateSourceRunState(knowledgeSourceId, {
            crawlStatus: gate.reason === 'quality_gate' ? CrawlStatus.COMPLETED : CrawlStatus.FAILED,
            progress: gate.reason === 'quality_gate' ? 100 : 0,
            lastError: gate.reason === 'quality_gate' ? null : 'Quality gate failed',
          });
        }
        await this.stats.refresh(knowledgeBaseId);
        await this.jobs.markFinished(
          jobId,
          gate.reason === 'quality_gate' ? KnowledgeJobStatus.SKIPPED : KnowledgeJobStatus.FAILED,
        );
        return gate.reason === 'quality_gate' ? 'SKIPPED' : 'FAILED';
      }

      await this.finalizeDocument(organizationId, knowledgeBaseId, documentId, result.text ?? '', {
        parserJobId,
        okContent: true,
        contentValidation: result.contentValidation,
        parserChars: result.chars ?? result.text?.length ?? 0,
        parserWarnings: result.warnings,
        rawHtml: result.html,
      }, knowledgeSourceId);

      if (knowledgeSourceId) {
        await this.updateSourceRunState(knowledgeSourceId, {
          crawlStatus: CrawlStatus.COMPLETED,
          progress: 100,
          lastSuccessAt: new Date(),
        });
      }

      await this.jobs.markFinished(jobId, KnowledgeJobStatus.SUCCESS, 100);
      return 'SUCCESS';
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.warn(`IngestUrl failed: ${errMsg}`);
      if (knowledgeSourceId) {
        await this.alerting?.parserFailure(knowledgeSourceId, url, errMsg);
      }
      await this.prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: KnowledgeDocumentStatus.FAILED },
      });
      if (knowledgeSourceId) {
        await this.updateSourceStats(knowledgeSourceId, false);
        await this.updateSourceRunState(knowledgeSourceId, {
          crawlStatus: CrawlStatus.FAILED,
          progress: 0,
          lastError: (err as Error).message,
        });
      }
      await this.stats.refresh(knowledgeBaseId);
      await this.jobs.markFinished(jobId, KnowledgeJobStatus.FAILED, 0, (err as Error).message);
      return 'FAILED';
    }
  }

  async runDocumentProcess(payload: DocumentProcessJobPayload): Promise<void> {
    await this.jobs.markRunning(payload.jobId);
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: payload.documentId } });
    if (!doc?.rawS3Key) {
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, 'No raw file');
      return;
    }

    try {
      if (doc.format === KnowledgeDocumentFormat.TXT || doc.format === KnowledgeDocumentFormat.MD) {
        const buffer = await this.storage.download(doc.rawS3Key);
        const text = buffer.toString('utf-8');
        const gate = passManualTextGate(text, 50);
        if (!gate.pass) {
          await this.prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: { status: KnowledgeDocumentStatus.SKIPPED_QUALITY },
          });
          await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SKIPPED);
          return;
        }
        await this.finalizeDocument(payload.organizationId, payload.knowledgeBaseId, doc.id, text, {
          okContent: true,
          parserChars: text.length,
        });
        await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
        return;
      }

      const presignedUrl = await this.storage.getPresignedUrl(doc.rawS3Key, 3600);
      const result = await this.parser.document({ url: presignedUrl });
      const gate = passDocumentQualityGate(result);

      if (!gate.pass) {
        await this.prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            status:
              gate.reason === 'min_chars'
                ? KnowledgeDocumentStatus.SKIPPED_QUALITY
                : KnowledgeDocumentStatus.FAILED,
            parserChars: result.chars ?? 0,
          },
        });
        await this.jobs.markFinished(
          payload.jobId,
          gate.reason === 'min_chars' ? KnowledgeJobStatus.SKIPPED : KnowledgeJobStatus.FAILED,
        );
        return;
      }

      await this.finalizeDocument(
        payload.organizationId,
        payload.knowledgeBaseId,
        doc.id,
        result.text ?? '',
        { okContent: true, parserChars: result.chars ?? result.text?.length ?? 0 },
      );
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
    } catch (err) {
      await this.prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: KnowledgeDocumentStatus.FAILED },
      });
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, (err as Error).message);
    }
  }

  async runZipExtract(payload: ZipExtractJobPayload): Promise<void> {
    await this.jobs.markRunning(payload.jobId);
    try {
      const childDocIds = await this.zipExtract.extractFromS3AndCreateDocuments({
        organizationId: payload.organizationId,
        knowledgeBaseId: payload.knowledgeBaseId,
        parentDocumentId: payload.documentId,
        rawS3Key: payload.rawS3Key,
      });

      await this.prisma.knowledgeDocument.update({
        where: { id: payload.documentId },
        data: { status: KnowledgeDocumentStatus.READY, metadata: { extractedCount: childDocIds.length } },
      });

      for (const childId of childDocIds) {
        await this.queue.enqueueDocumentProcess({
          organizationId: payload.organizationId,
          knowledgeBaseId: payload.knowledgeBaseId,
          documentId: childId,
        });
      }

      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
    } catch (err) {
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, (err as Error).message);
    }
  }

  async runManualText(
    organizationId: string,
    knowledgeBaseId: string,
    documentId: string,
    text: string,
  ): Promise<void> {
    await this.finalizeDocument(organizationId, knowledgeBaseId, documentId, text, {
      okContent: true,
      parserChars: text.length,
    });
  }

  async runReprocess(payload: ReprocessJobPayload): Promise<void> {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: payload.documentId } });
    if (!doc) {
      await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.FAILED, 0, 'Document not found');
      return;
    }

    if (doc.format === KnowledgeDocumentFormat.URL && (payload.url || doc.sourceUrl)) {
      await this.runIngestUrl({
        jobId: payload.jobId,
        organizationId: payload.organizationId,
        knowledgeBaseId: payload.knowledgeBaseId,
        documentId: payload.documentId,
        url: payload.url ?? doc.sourceUrl!,
        knowledgeSourceId: doc.knowledgeSourceId ?? undefined,
      });
      return;
    }

    await this.runDocumentProcess({
      jobId: payload.jobId,
      organizationId: payload.organizationId,
      knowledgeBaseId: payload.knowledgeBaseId,
      documentId: payload.documentId,
    });
  }

  private async finalizeDocument(
    organizationId: string,
    knowledgeBaseId: string,
    documentId: string,
    text: string,
    meta: {
      parserJobId?: string;
      okContent?: boolean;
      contentValidation?: unknown;
      parserChars?: number;
      parserWarnings?: unknown;
      rawHtml?: string;
      changeNote?: string;
    },
    knowledgeSourceId?: string,
  ) {
    const processedKey = this.storage.buildKey(
      organizationId,
      'processed',
      knowledgeBaseId,
      documentId,
      `v-${Date.now()}.txt`,
    );

    await this.storage.upload({
      key: processedKey,
      body: text,
      contentType: 'text/plain; charset=utf-8',
    });

    if (meta.rawHtml) {
      const htmlKey = this.storage.buildKey(
        organizationId,
        'raw',
        knowledgeBaseId,
        documentId,
        'page.html',
      );
      await this.storage.upload({
        key: htmlKey,
        body: meta.rawHtml,
        contentType: 'text/html; charset=utf-8',
      });
    }

    const existing = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    const nextVersion = (existing?.currentVersion ?? 0) + 1;

    await this.prisma.knowledgeDocumentVersion.create({
      data: {
        documentId,
        version: nextVersion,
        s3Key: processedKey,
        charCount: text.length,
        changeNote: meta.changeNote ?? (nextVersion === 1 ? 'Initial version' : 'Reprocessed'),
      },
    });

    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeDocumentStatus.READY,
        currentVersion: nextVersion,
        processedS3Key: processedKey,
        parserJobId: meta.parserJobId,
        okContent: meta.okContent ?? true,
        contentValidation: meta.contentValidation as object | undefined,
        parserChars: meta.parserChars ?? text.length,
        parserWarnings: meta.parserWarnings as object | undefined,
      },
    });

    if (knowledgeSourceId) await this.updateSourceStats(knowledgeSourceId, true, true);
    await this.stats.refresh(knowledgeBaseId);

    void this.workflowTriggers?.emitKbEvent(organizationId, 'SOURCE_PARSED', {
      documentId,
      knowledgeBaseId,
      version: nextVersion,
      charCount: text.length,
    });
    void this.workflowTriggers?.emitKbEvent(
      organizationId,
      nextVersion > 1 ? 'DOCUMENT_REINDEXED' : 'INGESTION_FINISHED',
      { documentId, knowledgeBaseId, version: nextVersion },
    );

    await this.queue.enqueueChunk({
      organizationId,
      knowledgeBaseId,
      documentId,
    });
  }

  private async updateSourceRunState(
    sourceId: string,
    patch: {
      crawlStatus?: CrawlStatus;
      progress?: number;
      lastRunAt?: Date;
      lastSuccessAt?: Date;
      lastError?: string | null;
    },
  ) {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) return;

    const meta = {
      ...(typeof source.metadata === 'object' && source.metadata ? source.metadata : {}),
    } as Record<string, unknown>;

    if (patch.progress !== undefined) meta.ingestProgress = patch.progress;
    if (patch.lastRunAt) meta.lastRunAt = patch.lastRunAt.toISOString();
    if (patch.lastSuccessAt) meta.lastSuccessAt = patch.lastSuccessAt.toISOString();

    await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        ...(patch.crawlStatus !== undefined ? { crawlStatus: patch.crawlStatus } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.lastSuccessAt ? { lastParsedAt: patch.lastSuccessAt } : {}),
        metadata: meta as object,
      },
    });
  }

  private async updateSourceStats(sourceId: string, success: boolean, okContent?: boolean) {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) return;

    const successCount = source.successCount + (success ? 1 : 0);
    const failureCount = source.failureCount + (success ? 0 : 1);
    const total = successCount + failureCount;
    const chars = success ? (source.metadata as { avgChars?: number })?.avgChars : undefined;

    const docs = await this.prisma.knowledgeDocument.aggregate({
      where: { knowledgeSourceId: sourceId, status: 'READY' },
      _avg: { parserChars: true },
    });

    await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        successCount,
        failureCount,
        successRate: total > 0 ? successCount / total : null,
        qualityScore:
          okContent === true && success
            ? ((source.qualityScore ?? 0) * Math.max(successCount - 1, 0) + 1) /
              Math.max(successCount, 1)
            : source.qualityScore,
        lastParsedAt: new Date(),
        lastError: success ? null : source.lastError,
        metadata: {
          ...(typeof source.metadata === 'object' && source.metadata ? source.metadata : {}),
          averageChars: docs._avg.parserChars ?? chars,
        },
      },
    });
  }
}
