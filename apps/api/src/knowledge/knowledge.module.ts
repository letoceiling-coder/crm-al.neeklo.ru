import { Module, forwardRef } from '@nestjs/common';
import { ParserClientModule } from '../parser-client/parser-client.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { ProviderAccountsModule } from '../provider-accounts/provider-accounts.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeSourcesController } from './knowledge-sources.controller';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeJobsController } from './knowledge-jobs.controller';
import { KnowledgeChunksController, KnowledgeEmbeddingsController } from './knowledge-chunks.controller';
import { KnowledgeRetrievalController } from './knowledge-retrieval.controller';
import {
  KnowledgeCategoriesController,
  KnowledgeTopicsController,
  KnowledgeTagsController,
} from './knowledge-taxonomy.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeSourceService } from './knowledge-source.service';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { KnowledgeTaxonomyService } from './knowledge-taxonomy.service';
import { KnowledgeStatsService } from './knowledge-stats.service';
import { KnowledgeJobService } from './jobs/knowledge-job.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import { IngestRunnerService } from './ingest-runner.service';
import { KnowledgePlanLimitsService } from './knowledge-plan-limits.service';
import { DomainProfileService } from './domain-profile.service';
import { SitemapExpansionService } from './domain/sitemap-expansion.service';
import { DomainDiscoveryService } from './domain/domain-discovery.service';
import { ZipExtractionService } from './domain/zip-extraction.service';
import { ChunkStrategyService } from './chunking/chunk-strategy.service';
import { ChunkingService } from './chunking/chunking.service';
import { ChunkRunnerService } from './chunking/chunk-runner.service';
import { EmbeddingClientService } from './embedding/embedding-client.service';
import { EmbeddingStoreService } from './embedding/embedding-store.service';
import { EmbeddingRunnerService } from './embedding/embedding-runner.service';
import { SearchService } from './search/search.service';
import { RetrievalService } from './search/retrieval.service';
import { KnowledgeChunkService } from './knowledge-chunk.service';
import {
  KnowledgeIngestProcessor,
  KnowledgeSourceExpandProcessor,
  KnowledgeDocumentProcessProcessor,
  KnowledgeZipExtractProcessor,
  KnowledgeReprocessProcessor,
} from './jobs/knowledge-processors';
import {
  KnowledgeChunkProcessor,
  KnowledgeEmbedProcessor,
  KnowledgeReembedProcessor,
} from './jobs/chunk-embed-processors';
import { WorkflowsModule } from '../workflows/workflows.module';
import {
  shouldRunKnowledgeWorkers,
} from '../config/app-role';

const knowledgeProcessors = shouldRunKnowledgeWorkers()
  ? [
      KnowledgeIngestProcessor,
      KnowledgeSourceExpandProcessor,
      KnowledgeDocumentProcessProcessor,
      KnowledgeZipExtractProcessor,
      KnowledgeReprocessProcessor,
      KnowledgeChunkProcessor,
      KnowledgeEmbedProcessor,
      KnowledgeReembedProcessor,
    ]
  : [];

@Module({
  imports: [ParserClientModule, StorageModule, QueueModule, ProviderAccountsModule, EmbeddingModule, forwardRef(() => WorkflowsModule)],
  controllers: [
    KnowledgeBasesController,
    KnowledgeSourcesController,
    KnowledgeDocumentsController,
    KnowledgeJobsController,
    KnowledgeChunksController,
    KnowledgeEmbeddingsController,
    KnowledgeRetrievalController,
    KnowledgeCategoriesController,
    KnowledgeTopicsController,
    KnowledgeTagsController,
  ],
  providers: [
    KnowledgeBaseService,
    KnowledgeSourceService,
    KnowledgeDocumentService,
    KnowledgeIngestService,
    KnowledgeTaxonomyService,
    KnowledgeStatsService,
    KnowledgeJobService,
    KnowledgeQueueService,
    IngestRunnerService,
    KnowledgePlanLimitsService,
    DomainProfileService,
    SitemapExpansionService,
    DomainDiscoveryService,
    ZipExtractionService,
    ChunkStrategyService,
    ChunkingService,
    ChunkRunnerService,
    EmbeddingClientService,
    EmbeddingStoreService,
    EmbeddingRunnerService,
    SearchService,
    RetrievalService,
    KnowledgeChunkService,
    ...knowledgeProcessors,
  ],
  exports: [
    KnowledgeBaseService,
    KnowledgeSourceService,
    KnowledgeDocumentService,
    KnowledgeIngestService,
    KnowledgeTaxonomyService,
    KnowledgeJobService,
    KnowledgeQueueService,
    RetrievalService,
    SearchService,
    EmbeddingClientService,
    EmbeddingStoreService,
  ],
})
export class KnowledgeModule {}
