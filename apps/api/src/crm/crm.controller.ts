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
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmEntityType } from '@prisma/client';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmClientService } from './crm-client.service';
import { CrmLeadService } from './crm-lead.service';
import { CrmDealService } from './crm-deal.service';
import { CrmTaskService } from './crm-task.service';
import { CrmNoteService } from './crm-note.service';
import { CrmActivityService } from './crm-activity.service';
import {
  CreateCrmClientDto,
  UpdateCrmClientDto,
  CreateCrmLeadDto,
  UpdateCrmLeadDto,
  CreateCrmDealDto,
  UpdateCrmDealDto,
  CreateCrmTaskDto,
  UpdateCrmTaskDto,
  CreateCrmNoteDto,
} from './dto/crm.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('v1/crm')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CrmController {
  constructor(
    private workspace: CrmWorkspaceService,
    private clients: CrmClientService,
    private leads: CrmLeadService,
    private deals: CrmDealService,
    private tasks: CrmTaskService,
    private notes: CrmNoteService,
    private activities: CrmActivityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'CRM workspace overview' })
  overview(@CurrentTenant() tenant: TenantContext) {
    return this.workspace.getOverview(tenant);
  }

  @Get('activities/timeline')
  @ApiOperation({ summary: 'Entity timeline (activities + notes)' })
  timeline(
    @CurrentTenant() tenant: TenantContext,
    @Query('entityType') entityType: CrmEntityType,
    @Query('entityId') entityId: string,
  ) {
    return this.activities.listTimeline(tenant.organizationId, entityType, entityId);
  }

  @Get('clients')
  listClients(@CurrentTenant() tenant: TenantContext) {
    return this.clients.list(tenant);
  }

  @Get('clients/:id')
  getClient(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.clients.findOne(tenant, id);
  }

  @Post('clients')
  createClient(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCrmClientDto) {
    return this.clients.create(tenant, dto);
  }

  @Patch('clients/:id')
  updateClient(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmClientDto,
  ) {
    return this.clients.update(tenant, id, dto);
  }

  @Delete('clients/:id')
  deleteClient(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.clients.remove(tenant, id);
  }

  @Get('leads')
  listLeads(@CurrentTenant() tenant: TenantContext) {
    return this.leads.list(tenant);
  }

  @Get('leads/:id')
  getLead(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.leads.findOne(tenant, id);
  }

  @Post('leads')
  createLead(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCrmLeadDto) {
    return this.leads.create(tenant, dto);
  }

  @Patch('leads/:id')
  updateLead(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmLeadDto,
  ) {
    return this.leads.update(tenant, id, dto);
  }

  @Delete('leads/:id')
  deleteLead(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.leads.remove(tenant, id);
  }

  @Get('deals')
  listDeals(@CurrentTenant() tenant: TenantContext) {
    return this.deals.list(tenant);
  }

  @Get('deals/:id')
  getDeal(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.deals.findOne(tenant, id);
  }

  @Post('deals')
  createDeal(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCrmDealDto) {
    return this.deals.create(tenant, dto);
  }

  @Patch('deals/:id')
  updateDeal(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmDealDto,
  ) {
    return this.deals.update(tenant, id, dto);
  }

  @Delete('deals/:id')
  deleteDeal(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.deals.remove(tenant, id);
  }

  @Get('tasks')
  listTasks(@CurrentTenant() tenant: TenantContext) {
    return this.tasks.list(tenant);
  }

  @Get('tasks/:id')
  getTask(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.tasks.findOne(tenant, id);
  }

  @Post('tasks')
  createTask(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCrmTaskDto) {
    return this.tasks.create(tenant, dto);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmTaskDto,
  ) {
    return this.tasks.update(tenant, id, dto);
  }

  @Delete('tasks/:id')
  deleteTask(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.tasks.remove(tenant, id);
  }

  @Get('notes')
  listNotes(
    @CurrentTenant() tenant: TenantContext,
    @Query('entityType') entityType: CrmEntityType,
    @Query('entityId') entityId: string,
  ) {
    return this.notes.list(tenant, entityType, entityId);
  }

  @Post('notes')
  createNote(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCrmNoteDto) {
    return this.notes.create(tenant, dto);
  }
}
