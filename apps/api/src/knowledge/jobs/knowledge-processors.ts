import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { JOB_NAMES, QUEUE_NAMES } from '../../queue/queue.constants';
import { IngestRunnerService } from '../ingest-runner.service';
import { KnowledgeQueueService } from './knowledge-queue.service';
import type {
  IngestUrlJobPayload,
  ExpandSitemapJobPayload,
  ExpandDomainJobPayload,
  DocumentProcessJobPayload,
  ZipExtractJobPayload,
  ReprocessJobPayload,
} from './knowledge-job.types';

@Processor(QUEUE_NAMES.KNOWLEDGE_INGEST)
export class KnowledgeIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeIngestProcessor.name);

  constructor(private runner: IngestRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.INGEST_URL) {
      return this.runner.runIngestUrl(job.data as IngestUrlJobPayload);
    }
    this.logger.warn(`Unknown job ${job.name}`);
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND)
export class KnowledgeSourceExpandProcessor extends WorkerHost {
  constructor(private queue: KnowledgeQueueService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.EXPAND_SITEMAP) {
      return this.queue.processExpandSitemap(job.data as ExpandSitemapJobPayload);
    }
    if (job.name === JOB_NAMES.EXPAND_DOMAIN) {
      return this.queue.processExpandDomain(job.data as ExpandDomainJobPayload);
    }
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS)
export class KnowledgeDocumentProcessProcessor extends WorkerHost {
  constructor(private runner: IngestRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.DOCUMENT_PROCESS) {
      return this.runner.runDocumentProcess(job.data as DocumentProcessJobPayload);
    }
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT)
export class KnowledgeZipExtractProcessor extends WorkerHost {
  constructor(private runner: IngestRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.ZIP_EXTRACT) {
      return this.runner.runZipExtract(job.data as ZipExtractJobPayload);
    }
  }
}

@Processor(QUEUE_NAMES.KNOWLEDGE_REPROCESS)
export class KnowledgeReprocessProcessor extends WorkerHost {
  constructor(private runner: IngestRunnerService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.REPROCESS) {
      return this.runner.runReprocess(job.data as ReprocessJobPayload);
    }
  }
}
