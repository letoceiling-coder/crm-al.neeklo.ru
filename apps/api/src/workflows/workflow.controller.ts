import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant, Public } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { WorkflowService } from './workflow.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowTriggerService } from './workflow-trigger.service';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { CreateWorkflowDto, UpdateWorkflowDto, RunWorkflowDto } from './dto/workflow.dto';

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('v1/workflows')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class WorkflowController {
  constructor(
    private workflows: WorkflowService,
    private runner: WorkflowRunnerService,
    private triggers: WorkflowTriggerService,
    private templates: WorkflowTemplateService,
    private metrics: WorkflowMetricsService,
    private queue: WorkflowQueueService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Workflow execution metrics' })
  getMetrics(@CurrentTenant() tenant: TenantContext) {
    return this.metrics.getMetrics(tenant);
  }

  @Get('templates/categories')
  @ApiOperation({ summary: 'List workflow template categories' })
  listTemplateCategories() {
    return this.templates.listCategories();
  }

  @Get('templates')
  @ApiOperation({ summary: 'List workflow templates' })
  listTemplates(@Query('category') category?: string) {
    return this.templates.listTemplates(category);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get workflow template' })
  getTemplate(@Param('id') id: string) {
    return this.templates.getTemplate(id);
  }

  @Post('templates/:id/instantiate')
  @ApiOperation({ summary: 'Create workflow from template' })
  instantiateTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    return this.templates.instantiate(tenant, id, body.name);
  }
  @Get()
  @ApiOperation({ summary: 'List workflows' })
  list(@CurrentTenant() tenant: TenantContext) {
    return this.workflows.list(tenant);
  }

  @Post('executions/:executionId/recover')
  @ApiOperation({ summary: 'Recover execution from DLQ' })
  recoverExecution(
    @CurrentTenant() tenant: TenantContext,
    @Param('executionId') executionId: string,
  ) {
    return this.runner.recoverFromDlq(tenant, executionId);
  }

  @Get('executions/list')
  @ApiOperation({ summary: 'List workflow executions' })
  listExecutions(
    @CurrentTenant() tenant: TenantContext,
    @Query('workflowId') workflowId?: string,
  ) {
    return this.runner.listExecutions(tenant, workflowId);
  }

  @Get('executions/:executionId')
  @ApiOperation({ summary: 'Get execution with logs' })
  getExecution(
    @CurrentTenant() tenant: TenantContext,
    @Param('executionId') executionId: string,
  ) {
    return this.runner.getExecution(tenant, executionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.workflows.findOne(tenant, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create workflow' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(tenant, dto).then(async (w) => {
      if (w.isActive && w.scheduleCron) {
        await this.triggers.registerScheduleIfNeeded(
          w.id, w.organizationId, w.scheduleCron, w.scheduleTimezone,
        );
      }
      return w;
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workflow (new version if steps changed)' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    const result = this.workflows.update(tenant, id, dto);
    return result.then(async (w) => {
      if (dto.isActive === false) {
        await this.queue.removeSchedule(w.id);
      } else if (w.scheduleCron) {
        await this.triggers.registerScheduleIfNeeded(
          w.id, w.organizationId, w.scheduleCron, w.scheduleTimezone,
        );
      }
      return w;
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workflow' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.queue.removeSchedule(id).then(() => this.workflows.remove(tenant, id));
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Manual workflow run' })
  run(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RunWorkflowDto,
  ) {
    return this.runner.startRun(id, tenant.organizationId, dto.triggerData ?? { manual: true });
  }
}

@ApiTags('Workflow Webhook')
@Controller('v1/workflows/webhook')
export class WorkflowWebhookController {
  constructor(private triggers: WorkflowTriggerService) {}

  @Public()
  @Post(':token')
  @ApiOperation({ summary: 'Trigger workflow by webhook token' })
  webhook(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.triggers.emitWebhook(token, body ?? {});
  }
}
