import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { QUEUE_NAMES } from './queue.constants';
import { QueueMonitoringService } from './queue-monitoring.service';
import { QueueMonitoringController } from './queue-monitoring.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.KNOWLEDGE_INGEST },
      { name: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND },
      { name: QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS },
      { name: QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT },
      { name: QUEUE_NAMES.KNOWLEDGE_REPROCESS },
      { name: QUEUE_NAMES.KNOWLEDGE_CHUNK },
      { name: QUEUE_NAMES.KNOWLEDGE_EMBED },
      { name: QUEUE_NAMES.KNOWLEDGE_REEMBED },
      { name: QUEUE_NAMES.MEMORY_SUMMARIZE },
      { name: QUEUE_NAMES.WORKFLOW_RUN },
      { name: QUEUE_NAMES.WORKFLOW_SCHEDULE },
      { name: QUEUE_NAMES.WORKFLOW_RETRY },
      { name: QUEUE_NAMES.WORKFLOW_DLQ },
      { name: QUEUE_NAMES.PARSER_JOBS },
      { name: QUEUE_NAMES.INTEGRATION_EVENTS },
      { name: QUEUE_NAMES.TOOL_EXECUTION },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.KNOWLEDGE_INGEST, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_SOURCE_EXPAND, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_DOCUMENT_PROCESS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_ZIP_EXTRACT, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_REPROCESS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_CHUNK, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_EMBED, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.KNOWLEDGE_REEMBED, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.MEMORY_SUMMARIZE, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.WORKFLOW_RUN, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.WORKFLOW_SCHEDULE, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.WORKFLOW_RETRY, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.WORKFLOW_DLQ, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.PARSER_JOBS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.INTEGRATION_EVENTS, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.TOOL_EXECUTION, adapter: BullMQAdapter },
    ),
  ],
  controllers: [QueueMonitoringController],
  providers: [QueueMonitoringService],
  exports: [BullModule, QueueMonitoringService],
})
export class QueueModule {}
