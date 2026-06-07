import { Injectable, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmWorkspaceService } from './crm-workspace.service';
import { CrmActivityService } from './crm-activity.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';
import { CreateCrmNoteDto } from './dto/crm.dto';

@Injectable()
export class CrmNoteService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
    private activities: CrmActivityService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async list(tenant: TenantContext, entityType: CrmEntityType, entityId: string) {
    await this.assertEntityExists(tenant.organizationId, entityType, entityId);
    return this.prisma.crmNote.findMany({
      where: { organizationId: tenant.organizationId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async create(tenant: TenantContext, dto: CreateCrmNoteDto, sourceAgentId?: string) {
    await this.assertEntityExists(tenant.organizationId, dto.entityType, dto.entityId);
    const ws = await this.workspace.ensureWorkspace(tenant.organizationId);
    const note = await this.prisma.crmNote.create({
      data: {
        organizationId: tenant.organizationId,
        workspaceId: ws.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        content: dto.content,
        createdById: tenant.userId,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    await this.activities.log({
      organizationId: tenant.organizationId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      action: CrmActivityAction.NOTE_ADDED,
      metadata: { noteId: note.id, sourceAgentId },
      createdById: tenant.userId,
    });
    void this.workflowTriggers?.emitCrmEvent(tenant.organizationId, 'NOTE_CREATED', {
      noteId: note.id,
      entityType: dto.entityType,
      entityId: dto.entityId,
    });
    return note;
  }

  private async assertEntityExists(
    organizationId: string,
    entityType: CrmEntityType,
    entityId: string,
  ) {
    const checks: Record<CrmEntityType, () => Promise<{ organizationId: string } | null>> = {
      CLIENT: () => this.prisma.crmClient.findUnique({ where: { id: entityId } }),
      LEAD: () => this.prisma.crmLead.findUnique({ where: { id: entityId } }),
      DEAL: () => this.prisma.crmDeal.findUnique({ where: { id: entityId } }),
      TASK: () => this.prisma.crmTask.findUnique({ where: { id: entityId } }),
    };
    const row = await checks[entityType]();
    if (!row) throw new NotFoundException(`${entityType} not found`);
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Entity belongs to another organization');
    }
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.crmNote.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Note not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Note belongs to another organization');
    }
    return row;
  }
}
