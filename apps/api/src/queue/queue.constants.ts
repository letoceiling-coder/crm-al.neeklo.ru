export const QUEUE_NAMES = {
  KNOWLEDGE_INGEST: 'knowledge-ingest',
  KNOWLEDGE_SOURCE_EXPAND: 'knowledge-source-expand',
  KNOWLEDGE_DOCUMENT_PROCESS: 'knowledge-document-process',
  KNOWLEDGE_ZIP_EXTRACT: 'knowledge-zip-extract',
  KNOWLEDGE_REPROCESS: 'knowledge-reprocess',
  KNOWLEDGE_CHUNK: 'knowledge-chunk',
  KNOWLEDGE_EMBED: 'knowledge-embed',
  KNOWLEDGE_REEMBED: 'knowledge-reembed',
  MEMORY_SUMMARIZE: 'memory-summarize',
  WORKFLOW_RUN: 'workflow-run',
  WORKFLOW_SCHEDULE: 'workflow-schedule',
  WORKFLOW_RETRY: 'workflow-retry',
  WORKFLOW_DLQ: 'workflow-dlq',
  PARSER_JOBS: 'parser-jobs',
  INTEGRATION_EVENTS: 'integration-events',
  TOOL_EXECUTION: 'tool-execution',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** BullMQ job name constants */
export const JOB_NAMES = {
  INGEST_URL: 'IngestUrlJob',
  EXPAND_SITEMAP: 'ExpandSitemapJob',
  EXPAND_DOMAIN: 'ExpandDomainJob',
  DOCUMENT_PROCESS: 'DocumentProcessJob',
  ZIP_EXTRACT: 'ZipExtractJob',
  REPROCESS: 'ReprocessDocumentJob',
  CHUNK: 'ChunkDocumentJob',
  EMBED: 'EmbedDocumentJob',
  REEMBED: 'ReembedJob',
  MEMORY_SUMMARIZE: 'MemorySummarizeJob',
  WORKFLOW_RUN: 'WorkflowRunJob',
  WORKFLOW_SCHEDULE_TICK: 'WorkflowScheduleTickJob',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
