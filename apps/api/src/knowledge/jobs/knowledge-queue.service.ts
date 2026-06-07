import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../../queue/queue.constants';
import {
  JOB_TYPE_TO_BULL_NAME,
  JOB_TYPE_TO_QUEUE,
  IngestUrlJobPayload,
  ExpandSitemapJobPayload,
  ExpandDomainJobPayload,
  DocumentProcessJobPayload,
  ZipExtractJobPayload,
  ReprocessJobPayload,
  ChunkJobPayload,
  EmbedJobPayload,
  ReembedJobPayload,
} from './knowledge-job.types';
import { KnowledgeJobService } from './knowledge-job.service';
import { KnowledgePlanLimitsService } from '../knowledge-plan-limits.service';
import { KnowledgeJobType } from '@prisma/client';
import { SitemapExpansionService } from '../domain/sitemap-expansion.service';
import { DomainDiscoveryService } from '../domain/domain-discovery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CrawlStatus, KnowledgeDocumentFormat, KnowledgeDocumentStatus, KnowledgeJobStatus } from '@prisma/client';
import { DEFAULT_CRAWL_SETTINGS, DomainCrawlSettings } from './knowledge-job.types';

@Injectable()
export class KnowledgeQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_INGEST) private ingestQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND) private expandQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS) private docQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT) private zipQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_REPROCESS) private reprocessQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_CHUNK) private chunkQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_EMBED) private embedQueue: Queue,
    @InjectQueue(QUEUE_NAMES.KNOWLEDGE_REEMBED) private reembedQueue: Queue,
    private jobs: KnowledgeJobService,
    private limits: KnowledgePlanLimitsService,
    private sitemap: SitemapExpansionService,
    private domainDiscovery: DomainDiscoveryService,
    private prisma: PrismaService,
  ) {}

  private queueFor(type: KnowledgeJobType): Queue {
    const name = JOB_TYPE_TO_QUEUE[type];
    if (name === QUEUE_NAMES.KNOWLEDGE_INGEST) return this.ingestQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND) return this.expandQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS) return this.docQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT) return this.zipQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_CHUNK) return this.chunkQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_EMBED) return this.embedQueue;
    if (name === QUEUE_NAMES.KNOWLEDGE_REEMBED) return this.reembedQueue;
    return this.reprocessQueue;
  }

  async enqueueIngestUrl(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    url: string;
    knowledgeSourceId?: string;
    parserModeOverride?: string | null;
    parentJobId?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.INGEST_URL,
      knowledgeSourceId: params.knowledgeSourceId,
      knowledgeDocumentId: params.documentId,
      parentJobId: params.parentJobId,
      queueName: QUEUE_NAMES.KNOWLEDGE_INGEST,
      metadata: { url: params.url },
    });

    const payload: IngestUrlJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      url: params.url,
      knowledgeSourceId: params.knowledgeSourceId,
      parserModeOverride: params.parserModeOverride,
    };

    const bull = await this.ingestQueue.add(JOB_NAMES.INGEST_URL, payload, {
      jobId: `ingest-url-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueExpandSitemap(params: {
    organizationId: string;
    knowledgeBaseId: string;
    sourceId: string;
    sitemapUrl: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.EXPAND_SITEMAP,
      knowledgeSourceId: params.sourceId,
      queueName: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND,
      metadata: { sitemapUrl: params.sitemapUrl },
    });

    const payload: ExpandSitemapJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      sourceId: params.sourceId,
      sitemapUrl: params.sitemapUrl,
    };

    const bull = await this.expandQueue.add(JOB_NAMES.EXPAND_SITEMAP, payload, {
      jobId: `expand-sitemap-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueExpandDomain(params: {
    organizationId: string;
    knowledgeBaseId: string;
    sourceId: string;
    startUrl: string;
    crawlSettings?: DomainCrawlSettings;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.EXPAND_DOMAIN,
      knowledgeSourceId: params.sourceId,
      queueName: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND,
      metadata: { startUrl: params.startUrl },
    });

    const payload: ExpandDomainJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      sourceId: params.sourceId,
      startUrl: params.startUrl,
      crawlSettings: params.crawlSettings ?? DEFAULT_CRAWL_SETTINGS,
    };

    const bull = await this.expandQueue.add(JOB_NAMES.EXPAND_DOMAIN, payload, {
      jobId: `expand-domain-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueDocumentProcess(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    parentJobId?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.DOCUMENT_PROCESS,
      knowledgeDocumentId: params.documentId,
      parentJobId: params.parentJobId,
      queueName: QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS,
    });

    const payload: DocumentProcessJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
    };

    const bull = await this.docQueue.add(JOB_NAMES.DOCUMENT_PROCESS, payload, {
      jobId: `doc-process-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueZipExtract(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    rawS3Key: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.ZIP_EXTRACT,
      knowledgeDocumentId: params.documentId,
      queueName: QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT,
    });

    const payload: ZipExtractJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      rawS3Key: params.rawS3Key,
    };

    const bull = await this.zipQueue.add(JOB_NAMES.ZIP_EXTRACT, payload, {
      jobId: `zip-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueReprocess(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    url?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.REPROCESS,
      knowledgeDocumentId: params.documentId,
      queueName: QUEUE_NAMES.KNOWLEDGE_REPROCESS,
      metadata: params.url ? { url: params.url } : {},
    });

    const payload: ReprocessJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      url: params.url,
    };

    const bull = await this.reprocessQueue.add(JOB_NAMES.REPROCESS, payload, {
      jobId: `reprocess-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  /** Called by ExpandSitemap processor */
  async processExpandSitemap(payload: ExpandSitemapJobPayload) {
    await this.jobs.markRunning(payload.jobId);
    const maxUrls = await this.limits.getMaxUrlsPerSitemap(payload.organizationId);
    const urls = await this.sitemap.expandSitemap(payload.sitemapUrl, maxUrls);

    await this.prisma.knowledgeSource.update({
      where: { id: payload.sourceId },
      data: { crawlStatus: CrawlStatus.ACTIVE },
    });

    let queued = 0;
    for (const url of urls) {
      await this.limits.assertCanCreateDocument(payload.organizationId, payload.knowledgeBaseId);
      const doc = await this.prisma.knowledgeDocument.create({
        data: {
          organizationId: payload.organizationId,
          knowledgeBaseId: payload.knowledgeBaseId,
          knowledgeSourceId: payload.sourceId,
          title: url,
          format: KnowledgeDocumentFormat.URL,
          sourceUrl: url,
          status: KnowledgeDocumentStatus.PENDING,
        },
      });
      await this.enqueueIngestUrl({
        organizationId: payload.organizationId,
        knowledgeBaseId: payload.knowledgeBaseId,
        documentId: doc.id,
        url,
        knowledgeSourceId: payload.sourceId,
        parentJobId: payload.jobId,
      });
      queued++;
    }

    await this.prisma.knowledgeSource.update({
      where: { id: payload.sourceId },
      data: { crawlStatus: CrawlStatus.COMPLETED, lastParsedAt: new Date() },
    });

    await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
    return { urlsFound: urls.length, queued };
  }

  /** Called by ExpandDomain processor */
  async processExpandDomain(payload: ExpandDomainJobPayload) {
    await this.jobs.markRunning(payload.jobId);

    const robots = await this.domainDiscovery.fetchRobots(payload.startUrl);
    let urls: string[] = [];

    if (robots.sitemapUrls.length > 0) {
      const maxUrls = await this.limits.getMaxUrlsPerSitemap(payload.organizationId);
      for (const sm of robots.sitemapUrls.slice(0, 3)) {
        urls.push(...(await this.sitemap.expandSitemap(sm, maxUrls)));
      }
    }

    if (urls.length === 0) {
      urls = await this.domainDiscovery.discoverUrls(payload.startUrl, payload.crawlSettings);
    }

    urls = [...new Set(urls)].slice(0, payload.crawlSettings.maxPages ?? 100);

    for (const url of urls) {
      await this.limits.assertCanCreateDocument(payload.organizationId, payload.knowledgeBaseId);
      const doc = await this.prisma.knowledgeDocument.create({
        data: {
          organizationId: payload.organizationId,
          knowledgeBaseId: payload.knowledgeBaseId,
          knowledgeSourceId: payload.sourceId,
          title: url,
          format: KnowledgeDocumentFormat.URL,
          sourceUrl: url,
          status: KnowledgeDocumentStatus.PENDING,
        },
      });
      await this.enqueueIngestUrl({
        organizationId: payload.organizationId,
        knowledgeBaseId: payload.knowledgeBaseId,
        documentId: doc.id,
        url,
        knowledgeSourceId: payload.sourceId,
        parentJobId: payload.jobId,
      });
    }

    await this.prisma.knowledgeSource.update({
      where: { id: payload.sourceId },
      data: {
        crawlStatus: robots.allowed ? CrawlStatus.COMPLETED : CrawlStatus.BLOCKED,
        lastParsedAt: new Date(),
      },
    });

    await this.jobs.markFinished(payload.jobId, KnowledgeJobStatus.SUCCESS, 100);
    return { urlsFound: urls.length };
  }

  async enqueueChunk(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    versionId?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.CHUNK,
      knowledgeDocumentId: params.documentId,
      queueName: QUEUE_NAMES.KNOWLEDGE_CHUNK,
      metadata: params.versionId ? { versionId: params.versionId } : {},
    });

    const payload: ChunkJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      versionId: params.versionId,
    };

    const bull = await this.chunkQueue.add(JOB_NAMES.CHUNK, payload, {
      jobId: `chunk-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueEmbed(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    profileId?: string;
    parentJobId?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.EMBED,
      knowledgeDocumentId: params.documentId,
      parentJobId: params.parentJobId,
      queueName: QUEUE_NAMES.KNOWLEDGE_EMBED,
      metadata: params.profileId ? { profileId: params.profileId } : {},
    });

    const payload: EmbedJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      profileId: params.profileId,
      parentJobId: params.parentJobId,
    };

    const bull = await this.embedQueue.add(JOB_NAMES.EMBED, payload, {
      jobId: `embed-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }

  async enqueueReembed(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId?: string;
    profileId?: string;
  }) {
    await this.limits.assertCanCreateJob(params.organizationId);

    const job = await this.jobs.createJob({
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      type: KnowledgeJobType.REEMBED,
      knowledgeDocumentId: params.documentId,
      queueName: QUEUE_NAMES.KNOWLEDGE_REEMBED,
      metadata: {
        ...(params.documentId ? { documentId: params.documentId } : { scope: 'knowledge_base' }),
        ...(params.profileId ? { profileId: params.profileId } : {}),
      },
    });

    const payload: ReembedJobPayload = {
      jobId: job.id,
      organizationId: params.organizationId,
      knowledgeBaseId: params.knowledgeBaseId,
      documentId: params.documentId,
      profileId: params.profileId,
    };

    const bull = await this.reembedQueue.add(JOB_NAMES.REEMBED, payload, {
      jobId: `reembed-${job.id}`,
    });

    await this.prisma.knowledgeJob.update({
      where: { id: job.id },
      data: { bullJobId: bull.id },
    });

    return { jobId: job.id, status: 'QUEUED' as const };
  }
}
