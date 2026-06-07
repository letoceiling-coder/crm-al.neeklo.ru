import { Module, forwardRef } from '@nestjs/common';
import { ToolsCatalogController } from './tools-catalog.controller';
import { ToolsInstancesController } from './tools-instances.controller';
import { ToolCatalogService } from './tool-catalog.service';
import { ToolInstanceService } from './tool-instance.service';
import { AssistantToolBindingService } from './assistant-tool-binding.service';
import { ToolExecutionService } from './tool-execution.service';
import { ToolsPlanLimitsService } from './tools-plan-limits.service';
import { SecretsModule } from '../secrets/secrets.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CrmModule } from '../crm/crm.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    SecretsModule,
    KnowledgeModule,
    CrmModule,
    forwardRef(() => WorkflowsModule),
    forwardRef(() => IntegrationsModule),
  ],  controllers: [ToolsCatalogController, ToolsInstancesController],
  providers: [
    ToolCatalogService,
    ToolInstanceService,
    AssistantToolBindingService,
    ToolExecutionService,
    ToolsPlanLimitsService,
  ],
  exports: [
    ToolCatalogService,
    ToolInstanceService,
    AssistantToolBindingService,
    ToolExecutionService,
    ToolsPlanLimitsService,
  ],
})
export class ToolsModule {}
