import { Injectable, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { CreateCrmTaskDto, UpdateCrmTaskDto } from './dto/crm.dto';

@Injectable()
export class CrmTaskService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
    private activities: CrmActivityService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async list(tenant: TenantContext) {
    return this.prisma.crmTask.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.crmTask.findUnique({
      where: { id },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });
  }

  async create(tenant: TenantContext, dto: CreateCrmTaskDto, sourceAgentId?: string) {
    const ws = await this.workspace.ensureWorkspace(tenant.organizationId);
    const task = await this.prisma.crmTask.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: ws.id,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId: dto.assignedToId,
        sourceAgentId,
      },
    });
    await this.activities.log({
      organizationId: tenant.organizationId,
      entityType: CrmEntityType.TASK,
      entityId: task.id,
      action: CrmActivityAction.CREATED,
      metadata: { sourceAgentId, title: task.title },
      createdById: tenant.userId,
    });
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'TASK_CREATED', {
      taskId: task.id,
      title: task.title,
    });
    return task;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateCrmTaskDto) {
    const prev = await this.assertOwned(id, tenant.organizationId);
    const task = await this.prisma.crmTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
      },
    });
    if (dto.status && dto.status !== prev.status) {
      await this.activities.log({
        organizationId: tenant.organizationId,
        entityType: CrmEntityType.TASK,
        entityId: id,
        action: CrmActivityAction.STATUS_CHANGED,
        metadata: { from: prev.status, to: dto.status },
        createdById: tenant.userId,
      });
    }
    return task;
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.crmTask.delete({ where: { id } });
    return { deleted: true };
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.crmTask.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Task not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Task belongs to another organization');
    }
    return row;
  }
}
