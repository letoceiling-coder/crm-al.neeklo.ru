import { Injectable, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { CreateCrmLeadDto, UpdateCrmLeadDto } from './dto/crm.dto';

@Injectable()
export class CrmLeadService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
    private activities: CrmActivityService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async list(tenant: TenantContext) {
    return this.prisma.crmLead.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.crmLead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        deals: { orderBy: { updatedAt: 'desc' } },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateCrmLeadDto, sourceAgentId?: string) {
    const ws = await this.workspace.ensureWorkspace(tenant.organizationId);
    const lead = await this.prisma.crmLead.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: ws.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        source: dto.source ?? (sourceAgentId ? 'assistant' : undefined),
        status: dto.status,
        score: dto.score ?? 0,
        assignedToId: dto.assignedToId,
        sourceAgentId,
      },
    });
    await this.activities.log({
      organizationId: tenant.organizationId,
      entityType: CrmEntityType.LEAD,
      entityId: lead.id,
      action: CrmActivityAction.CREATED,
      metadata: { sourceAgentId, name: lead.name },
      createdById: tenant.userId,
    });
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'LEAD_CREATED', {
      leadId: lead.id,
      name: lead.name,
      status: lead.status,
    });
    return lead;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCrmLeadDto) {
    const prev = await this.assertOwned(id, tenant.organizationId);
    const lead = await this.prisma.crmLead.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.score !== undefined ? { score: dto.score } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
      },
    });
    if (dto.status && dto.status !== prev.status) {
      await this.activities.log({
        organizationId: tenant.organizationId,
        entityType: CrmEntityType.LEAD,
        entityId: id,
        action: CrmActivityAction.STATUS_CHANGED,
        metadata: { from: prev.status, to: dto.status },
        createdById: tenant.userId,
      });
      void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'LEAD_STATUS_CHANGED', {
        leadId: id,
        from: prev.status,
        to: dto.status,
      });
    }
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'LEAD_UPDATED', { leadId: id });
    return lead;
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.crmLead.delete({ where: { id } });
    return { deleted: true };
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.crmLead.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lead not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Lead belongs to another organization');
    }
    return row;
  }
}
