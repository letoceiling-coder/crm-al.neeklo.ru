import { Module, forwardRef } from '@nestjs/common';
import { WorkflowController, WorkflowWebhookController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowStepExecutorService } from './workflow-step-executor.service';
import { WorkflowTriggerService } from './workflow-trigger.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import {
  WorkflowRunProcessor,
  WorkflowRetryProcessor,
  WorkflowScheduleProcessor,
  WorkflowDlqProcessor,
} from './workflow.processors';
import { QueueModule } from '../queue/queue.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { ToolsModule } from '../tools/tools.module';
import { CrmModule } from '../crm/crm.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    QueueModule,
    forwardRef(() => AssistantsModule),
    forwardRef(() => ToolsModule),
    forwardRef(() => CrmModule),
    forwardRef(() => MemoryModule),
  ],
  controllers: [WorkflowController, WorkflowWebhookController],
  providers: [
    WorkflowService,
    WorkflowRunnerService,
    WorkflowStepExecutorService,
    WorkflowTriggerService,
    WorkflowQueueService,
    WorkflowTemplateService,
    WorkflowMetricsService,
    WorkflowRunProcessor,
    WorkflowRetryProcessor,
    WorkflowScheduleProcessor,
    WorkflowDlqProcessor,
  ],
  exports: [WorkflowService, WorkflowRunnerService, WorkflowTriggerService],
})
export class WorkflowsModule {}
