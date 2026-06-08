import { Module, forwardRef } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MemoryController } from './memory.controller';
import { MemoryProfileService } from './memory-profile.service';
import { MemoryEntryService } from './memory-entry.service';
import { MemorySearchService } from './memory-search.service';
import { MemoryEmbeddingService } from './memory-embedding.service';
import { MemorySummarizeService } from './memory-summarize.service';
import { MemoryQueueService } from './memory-queue.service';
import { MemoryPlanLimitsService } from './memory-plan-limits.service';
import { MemorySummarizeProcessor } from './memory.processors';
import { shouldRunMemoryWorkers } from '../config/app-role';

const memoryProcessors = shouldRunMemoryWorkers() ? [MemorySummarizeProcessor] : [];

@Module({
  imports: [QueueModule, forwardRef(() => KnowledgeModule)],
  controllers: [MemoryController],
  providers: [
    MemoryProfileService,
    MemoryEntryService,
    MemorySearchService,
    MemoryEmbeddingService,
    MemorySummarizeService,
    MemoryQueueService,
    MemoryPlanLimitsService,
    ...memoryProcessors,
  ],
  exports: [
    MemoryProfileService,
    MemoryEntryService,
    MemorySearchService,
    MemoryEmbeddingService,
    MemorySummarizeService,
  ],
})
export class MemoryModule {}
