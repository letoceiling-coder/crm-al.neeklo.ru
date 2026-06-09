import { Module, forwardRef } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { StorageModule } from '../storage/storage.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentCrmAdminController } from './admin/agentcrm-admin.controller';
import { AgentCrmAdminService } from './admin/agentcrm-admin.service';
import { AgentCrmConfigService } from './config/agentcrm-config.service';
import { AgentCrmProfileHintService } from './resolver/agentcrm-profile-hint.service';
import { AgentCrmModelResolverService } from './resolver/agentcrm-model-resolver.service';
import { EnrichmentCacheService } from './cache/enrichment-cache.service';
import { KqsService } from './kqs/kqs.service';
import { ModelStageStatsService } from './stats/model-stage-stats.service';
import { PipelineRunService } from './pipeline/pipeline-run.service';
import { AgentCrmOrchestratorService } from './pipeline/agentcrm-orchestrator.service';
import { EnrichmentPipelineService } from './pipeline/enrichment-pipeline.service';
import { StageLlmExecutorService } from './pipeline/stage-llm-executor.service';
import { SemanticChunkingService } from './chunking/semantic-chunking.service';
import { DocumentPreChunkService } from './chunking/document-pre-chunk.service';
import { JsonRepairService } from './pipeline/json/json-repair.service';
import { AdaptiveRateControllerService } from './pipeline/rate/adaptive-rate-controller.service';
import { EntityMergeService } from './pipeline/merge/entity-merge.service';
import { ClassificationMergeService } from './pipeline/merge/classification-merge.service';
import { StructureMergeService } from './pipeline/merge/structure-merge.service';
import { HierarchicalSummaryService } from './pipeline/summary/hierarchical-summary.service';
import { SecondOpinionValidationService } from './pipeline/validation/second-opinion-validation.service';
import { AutoTaxonomyService } from './pipeline/auto-taxonomy.service';
import { StageRecoveryService } from './pipeline/recovery/stage-recovery.service';
import { PartialRepairService } from './pipeline/repair/partial-repair.service';
import { AgentCrmQueueService } from './queue/agentcrm-queue.service';
import { AgentCrmRouterService } from './router/agentcrm-router.service';
import { KnowledgeSourceAdapterRegistry } from './adapters/knowledge-source-adapter.registry';
import { PipelinePromptService } from './prompts/pipeline-prompt.service';
import { QueryAnalysisService } from './retrieval/query-analysis.service';
import { RetrievalStrategyService } from './retrieval/retrieval-strategy.service';
import { RetrievalSourcesService } from './retrieval/retrieval-sources.service';
import { RrfFusionService } from './retrieval/rrf-fusion.service';
import { KqsBoostService } from './retrieval/kqs-boost.service';
import { RerankService } from './retrieval/rerank.service';
import { ContextPackingService } from './retrieval/context-packing.service';
import { RetrievalQueryLogService } from './retrieval/retrieval-query-log.service';
import { RetrievalV2Service } from './retrieval/retrieval-v2.service';
import { AgentCrmRetrievalAdminController } from './admin/agentcrm-retrieval-admin.controller';
import { AgentCrmBenchmarkAdminController } from './admin/agentcrm-benchmark-admin.controller';
import { BenchmarkQuestionsService } from './benchmark/benchmark-questions.service';
import { BenchmarkRunnerService } from './benchmark/benchmark-runner.service';
import { AgentCrmPipelineProcessor } from './queue/agentcrm-pipeline.processor';
import { shouldRunKnowledgeWorkers } from '../config/app-role';

const processors = shouldRunKnowledgeWorkers() ? [AgentCrmPipelineProcessor] : [];

@Module({
  imports: [
    QueueModule,
    OpenRouterModule,
    StorageModule,
    forwardRef(() => KnowledgeModule),
  ],
  controllers: [AgentCrmAdminController, AgentCrmRetrievalAdminController, AgentCrmBenchmarkAdminController],
  providers: [
    AgentCrmAdminService,
    AgentCrmConfigService,
    AgentCrmProfileHintService,
    AgentCrmModelResolverService,
    EnrichmentCacheService,
    KqsService,
    ModelStageStatsService,
    PipelineRunService,
    AgentCrmOrchestratorService,
    EnrichmentPipelineService,
    StageLlmExecutorService,
    SemanticChunkingService,
    DocumentPreChunkService,
    JsonRepairService,
    AdaptiveRateControllerService,
    EntityMergeService,
    ClassificationMergeService,
    StructureMergeService,
    HierarchicalSummaryService,
    SecondOpinionValidationService,
    AutoTaxonomyService,
    StageRecoveryService,
    PartialRepairService,
    AgentCrmQueueService,
    AgentCrmRouterService,
    KnowledgeSourceAdapterRegistry,
    PipelinePromptService,
    QueryAnalysisService,
    RetrievalStrategyService,
    RetrievalSourcesService,
    RrfFusionService,
    KqsBoostService,
    RerankService,
    ContextPackingService,
    RetrievalQueryLogService,
    RetrievalV2Service,
    BenchmarkQuestionsService,
    BenchmarkRunnerService,
    ...processors,
  ],
  exports: [AgentCrmRouterService, AgentCrmConfigService, RetrievalV2Service, BenchmarkRunnerService],
})
export class AgentCrmModule {}
