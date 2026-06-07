import { Injectable, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { CreateCrmClientDto, UpdateCrmClientDto } from './dto/crm.dto';

@Injectable()
export class CrmClientService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
    private activities: CrmActivityService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async list(tenant: TenantContext) {
    return this.prisma.crmClient.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    const client = await this.prisma.crmClient.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        deals: { orderBy: { updatedAt: 'desc' }, take: 10 },
      },
    });
    const timeline = await this.activities.listTimeline(
      tenant.organizationId,
      CrmEntityType.CLIENT,
      id,
    );
    return { ...client, timeline };
  }

  async create(tenant: TenantContext, dto: CreateCrmClientDto, sourceAgentId?: string) {
    const ws = await this.workspace.ensureWorkspace(tenant.organizationId);
    const client = await this.prisma.crmClient.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: ws.id,
        name: dto.name,
        company: dto.company,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        tags: dto.tags ?? [],
        status: dto.status,
        ownerId: dto.ownerId ?? tenant.userId,
      },
    });
    await this.activities.log({
      organizationId: tenant.organizationId,
      entityType: CrmEntityType.CLIENT,
      entityId: client.id,
      action: CrmActivityAction.CREATED,
      metadata: { sourceAgentId, name: client.name },
      createdById: tenant.userId,
    });
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'CLIENT_CREATED', {
      clientId: client.id,
      name: client.name,
    });
    return client;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCrmClientDto) {
    const prev = await this.assertOwned(id, tenant.organizationId);
    const client = await this.prisma.crmClient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      },
    });
    if (dto.status && dto.status !== prev.status) {
      await this.activities.log({
        organizationId: tenant.organizationId,
        entityType: CrmEntityType.CLIENT,
        entityId: id,
        action: CrmActivityAction.STATUS_CHANGED,
        metadata: { from: prev.status, to: dto.status },
        createdById: tenant.userId,
      });
    } else {
      await this.activities.log({
        organizationId: tenant.organizationId,
        entityType: CrmEntityType.CLIENT,
        entityId: id,
        action: CrmActivityAction.UPDATED,
        createdById: tenant.userId,
      });
    }
    return client;
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.crmClient.delete({ where: { id } });
    return { deleted: true };
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.crmClient.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Client not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Client belongs to another organization');
    }
    return row;
  }
}
