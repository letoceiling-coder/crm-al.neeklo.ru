import { Injectable, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { CreateCrmDealDto, UpdateCrmDealDto } from './dto/crm.dto';

@Injectable()
export class CrmDealService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
    private activities: CrmActivityService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async list(tenant: TenantContext) {
    return this.prisma.crmDeal.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.crmDeal.findUnique({
      where: { id },
      include: {
        client: true,
        lead: true,
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateCrmDealDto, sourceAgentId?: string) {
    const ws = await this.workspace.ensureWorkspace(tenant.organizationId);
    const deal = await this.prisma.crmDeal.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: ws.id,
        name: dto.name,
        amount: dto.amount ?? 0,
        currency: dto.currency ?? 'RUB',
        status: dto.status,
        clientId: dto.clientId,
        leadId: dto.leadId,
        sourceAgentId,
      },
    });
    await this.activities.log({
      organizationId: tenant.organizationId,
      entityType: CrmEntityType.DEAL,
      entityId: deal.id,
      action: CrmActivityAction.CREATED,
      metadata: { sourceAgentId, name: deal.name, amount: deal.amount },
      createdById: tenant.userId,
    });
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'DEAL_CREATED', {
      dealId: deal.id,
      name: deal.name,
      amount: deal.amount,
    });
    return deal;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCrmDealDto) {
    const prev = await this.assertOwned(id, tenant.organizationId);
    const deal = await this.prisma.crmDeal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      },
    });
    if (dto.status && dto.status !== prev.status) {
      await this.activities.log({
        organizationId: tenant.organizationId,
        entityType: CrmEntityType.DEAL,
        entityId: id,
        action: CrmActivityAction.STATUS_CHANGED,
        metadata: { from: prev.status, to: dto.status },
        createdById: tenant.userId,
      });
    }
    return deal;
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.crmDeal.delete({ where: { id } });
    return { deleted: true };
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.crmDeal.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Deal not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Deal belongs to another organization');
    }
    return row;
  }
}
