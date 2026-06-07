import { Injectable } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrmWorkspaceService } from './crm-workspace.service';

@Injectable()
export class CrmActivityService {
  constructor(
    private prisma: PrismaService,
    private workspace: CrmWorkspaceService,
  ) {}

  async log(params: {
    organizationId: string;
    entityType: CrmEntityType;
    entityId: string;
    action: CrmActivityAction;
    metadata?: Record<string, unknown>;
    createdById?: string;
  }) {
    const ws = await this.workspace.ensureWorkspace(params.organizationId);
    return this.prisma.crmActivity.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: ws.id,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: (params.metadata ?? {}) as object,
        createdById: params.createdById,
      },
    });
  }

  async listTimeline(organizationId: string, entityType: CrmEntityType, entityId: string) {
    const [activities, notes] = await Promise.all([
      this.prisma.crmActivity.findMany({
        where: { organizationId, entityType, entityId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.crmNote.findMany({
        where: { organizationId, entityType, entityId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const timeline = [
      ...activities.map((a) => ({
        kind: 'activity' as const,
        id: a.id,
        action: a.action,
        metadata: a.metadata,
        createdAt: a.createdAt,
        createdBy: a.createdBy,
      })),
      ...notes.map((n) => ({
        kind: 'note' as const,
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
        createdBy: n.createdBy,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return timeline;
  }
}
