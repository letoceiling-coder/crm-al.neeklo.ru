export type KnowledgeBaseStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type KnowledgeSourceType = 'URL' | 'SITEMAP' | 'DOMAIN' | 'RSS' | 'FILE' | 'API';
export type CrawlStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
export type KnowledgeDocumentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'SKIPPED_QUALITY'
  | 'FAILED';
export type KnowledgeDocumentFormat =
  | 'PDF'
  | 'DOCX'
  | 'TXT'
  | 'MD'
  | 'HTML'
  | 'URL'
  | 'ZIP'
  | 'MANUAL';

export interface KbStats {
  documentCount: number;
  sourceCount: number;
  readyCount: number;
  failedCount: number;
  skippedQualityCount: number;
  pendingCount: number;
  totalChars: number;
  chunkCount?: number;
  indexedCount?: number;
}

export interface KnowledgeBaseListItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: KnowledgeBaseStatus;
  stats: KbStats;
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number; sources: number; categories: number };
}

export interface KnowledgeBaseDetail extends KnowledgeBaseListItem {
  stats: KbStats;
  _count?: {
    documents: number;
    sources: number;
    categories: number;
    topics: number;
    tags: number;
  };
}

export interface KnowledgeSource {
  id: string;
  type: KnowledgeSourceType;
  name?: string | null;
  url?: string | null;
  domain?: string | null;
  crawlStatus: CrawlStatus;
  parserMode?: string | null;
  successRate?: number | null;
  qualityScore?: number | null;
  lastParsedAt?: string | null;
  _count?: { documents: number };
}

export interface KnowledgeDocument {
  id: string;
  title?: string | null;
  format: KnowledgeDocumentFormat;
  sourceUrl?: string | null;
  status: KnowledgeDocumentStatus;
  currentVersion: number;
  parserChars?: number | null;
  okContent?: boolean | null;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  _count?: { documents: number; topics: number };
}

export interface KnowledgeTopic {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  category?: { id: string; name: string };
  _count?: { documents: number };
}

export interface KnowledgeTag {
  id: string;
  name: string;
  slug: string;
  _count?: { documents: number };
}

export const KB_STATUS_LABELS: Record<KnowledgeBaseStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активна',
  ARCHIVED: 'Архив',
};

export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  URL: 'URL',
  SITEMAP: 'Sitemap',
  DOMAIN: 'Домен',
  RSS: 'RSS',
  FILE: 'Файл',
  API: 'API',
};

export type SourceHealthStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export const CRAWL_STATUS_LABELS: Record<CrawlStatus, string> = {
  PENDING: 'Ожидает',
  ACTIVE: 'Обрабатывается',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  BLOCKED: 'Заблокирован',
};

export const SOURCE_STATUS_LABELS: Record<SourceHealthStatus, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'Обрабатывается',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
};

export const DOC_STATUS_LABELS: Record<KnowledgeDocumentStatus, string> = {
  PENDING: 'В очереди',
  PROCESSING: 'Обрабатывается',
  READY: 'Готово',
  SKIPPED_QUALITY: 'Пропущен (качество)',
  FAILED: 'Ошибка',
};

export type KnowledgeJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type KnowledgeJobType =
  | 'INGEST_URL'
  | 'EXPAND_SITEMAP'
  | 'EXPAND_DOMAIN'
  | 'DOCUMENT_PROCESS'
  | 'ZIP_EXTRACT'
  | 'REPROCESS'
  | 'CHUNK'
  | 'EMBED'
  | 'REEMBED';

export type KnowledgeEmbeddingStatus =
  | 'PENDING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXED'
  | 'FAILED';

export interface KnowledgeJob {
  id: string;
  type: KnowledgeJobType;
  status: KnowledgeJobStatus;
  progress: number;
  queueName: string;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  knowledgeBase?: { id: string; name: string; slug: string };
  knowledgeSource?: { id: string; name?: string | null; url?: string | null; type?: string };
  knowledgeDocument?: { id: string; title?: string | null; format?: string; status?: string };
}

export const JOB_STATUS_LABELS: Record<KnowledgeJobStatus, string> = {
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  SUCCESS: 'Успешно',
  FAILED: 'Ошибка',
  SKIPPED: 'Пропущено',
  CANCELLED: 'Отменено',
};

export const JOB_TYPE_LABELS: Record<KnowledgeJobType, string> = {
  INGEST_URL: 'Парсинг URL',
  EXPAND_SITEMAP: 'Разбор Sitemap',
  EXPAND_DOMAIN: 'Обход домена',
  DOCUMENT_PROCESS: 'Обработка документа',
  ZIP_EXTRACT: 'Распаковка ZIP',
  REPROCESS: 'Повторная обработка',
  CHUNK: 'Чанкинг',
  EMBED: 'Эмбеддинг',
  REEMBED: 'Переиндексация',
};

export const EMBEDDING_STATUS_LABELS: Record<KnowledgeEmbeddingStatus, string> = {
  PENDING: 'Ожидает',
  CHUNKING: 'Чанкинг',
  EMBEDDING: 'Эмбеддинг',
  INDEXED: 'Проиндексирован',
  FAILED: 'Ошибка',
};

export interface KnowledgeChunkListItem {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  tokenCount: number;
  createdAt: string;
  document?: { id: string; title?: string | null; embeddingStatus?: string };
}

export interface EmbeddingSummary {
  chunkCount: number;
  indexedDocuments: number;
  totalReadyDocuments: number;
  embeddingProfile?: {
    id: string;
    name: string;
    model: string;
    provider: string;
    dimensions: number;
  } | null;
  documents: Array<{
    id: string;
    title?: string | null;
    chunkCount: number;
    charCount?: number | null;
    embeddingStatus: KnowledgeEmbeddingStatus;
    embeddingModel?: string | null;
  }>;
}

export interface SourceHealth {
  source: {
    id: string;
    name?: string | null;
    type: KnowledgeSourceType;
    status: SourceHealthStatus;
    crawlStatus: CrawlStatus;
    progress: number;
    lastRunAt?: string | null;
    lastSuccessAt?: string | null;
    lastParsedAt?: string | null;
    successRate?: number | null;
    qualityScore?: number | null;
    lastError?: string | null;
    parserMode?: string | null;
    averageChars?: number | null;
  };
  domainProfile?: {
    domain: string;
    recommendedMode?: string | null;
    successRate?: number | null;
    averageChars?: number | null;
    captchaDetected?: boolean;
    antiBotDetected?: boolean;
  } | null;
  recentJobs: KnowledgeJob[];
}

export const DOC_FORMAT_LABELS: Record<KnowledgeDocumentFormat, string> = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  TXT: 'TXT',
  MD: 'Markdown',
  HTML: 'HTML',
  URL: 'URL',
  ZIP: 'ZIP',
  MANUAL: 'Текст',
};
