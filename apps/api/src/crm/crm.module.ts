import { Module, forwardRef } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { WorkflowsModule } from '../workflows/workflows.module';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmClientService } from './crm-client.service';
import { CrmLeadService } from './crm-lead.service';
import { CrmDealService } from './crm-deal.service';
import { CrmTaskService } from './crm-task.service';
import { CrmNoteService } from './crm-note.service';
import { CrmActivityService } from './crm-activity.service';
import { CrmToolService } from './crm-tool.service';

@Module({
  imports: [forwardRef(() => WorkflowsModule)],
  controllers: [CrmController],
  providers: [
    CrmWorkspaceService,
    CrmClientService,
    CrmLeadService,
    CrmDealService,
    CrmTaskService,
    CrmNoteService,
    CrmActivityService,
    CrmToolService,
  ],
  exports: [CrmToolService, CrmWorkspaceService, CrmClientService, CrmLeadService, CrmTaskService, CrmNoteService],
})
export class CrmModule {}
