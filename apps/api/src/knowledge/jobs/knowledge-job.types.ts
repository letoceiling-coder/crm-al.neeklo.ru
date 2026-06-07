import { KnowledgeJobType } from '@prisma/client';
import { JOB_NAMES, QUEUE_NAMES } from '../../queue/queue.constants';

export const JOB_TYPE_TO_QUEUE: Record<KnowledgeJobType, string> = {
  INGEST_URL: QUEUE_NAMES.KNOWLEDGE_INGEST,
  EXPAND_SITEMAP: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND,
  EXPAND_DOMAIN: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND,
  DOCUMENT_PROCESS: QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS,
  ZIP_EXTRACT: QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT,
  REPROCESS: QUEUE_NAMES.KNOWLEDGE_REPROCESS,
  CHUNK: QUEUE_NAMES.KNOWLEDGE_CHUNK,
  EMBED: QUEUE_NAMES.KNOWLEDGE_EMBED,
  REEMBED: QUEUE_NAMES.KNOWLEDGE_REEMBED,
};

export const JOB_TYPE_TO_BULL_NAME: Record<KnowledgeJobType, string> = {
  INGEST_URL: JOB_NAMES.INGEST_URL,
  EXPAND_SITEMAP: JOB_NAMES.EXPAND_SITEMAP,
  EXPAND_DOMAIN: JOB_NAMES.EXPAND_DOMAIN,
  DOCUMENT_PROCESS: JOB_NAMES.DOCUMENT_PROCESS,
  ZIP_EXTRACT: JOB_NAMES.ZIP_EXTRACT,
  REPROCESS: JOB_NAMES.REPROCESS,
  CHUNK: JOB_NAMES.CHUNK,
  EMBED: JOB_NAMES.EMBED,
  REEMBED: JOB_NAMES.REEMBED,
};

export interface IngestUrlJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
  url: string;
  knowledgeSourceId?: string;
  parserModeOverride?: string | null;
}

export interface ExpandSitemapJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  sourceId: string;
  sitemapUrl: string;
}

export interface ExpandDomainJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  sourceId: string;
  startUrl: string;
  crawlSettings: DomainCrawlSettings;
}

export interface DocumentProcessJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
}

export interface ZipExtractJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
  rawS3Key: string;
}

export interface ReprocessJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
  url?: string;
}

export interface DomainCrawlSettings {
  maxDepth?: number;
  maxPages?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
}

export const DEFAULT_CRAWL_SETTINGS: DomainCrawlSettings = {
  maxDepth: 2,
  maxPages: 100,
  allowedPaths: [],
  blockedPaths: [],
};

export interface ChunkJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
  versionId?: string;
}

export interface EmbedJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId: string;
  profileId?: string;
  parentJobId?: string;
}

export interface ReembedJobPayload {
  jobId: string;
  organizationId: string;
  knowledgeBaseId: string;
  documentId?: string;
  profileId?: string;
}
