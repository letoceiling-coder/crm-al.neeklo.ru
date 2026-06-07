import { Injectable } from '@nestjs/common';
import { WorkflowExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class WorkflowMetricsService {
  constructor(private prisma: PrismaService) {}

  async getMetrics(tenant: TenantContext) {
    const orgId = tenant.organizationId;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalExecutions,
      completed,
      failed,
      dlq,
      waiting,
      retries,
      last24h,
      templateUsage,
      workflowsActive,
    ] = await Promise.all([
      this.prisma.workflowExecution.count({ where: { organizationId: orgId } }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, status: WorkflowExecutionStatus.COMPLETED },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, status: WorkflowExecutionStatus.FAILED },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, status: WorkflowExecutionStatus.DLQ },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, status: WorkflowExecutionStatus.WAITING },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, attempt: { gt: 1 } },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId: orgId, createdAt: { gte: since24h } },
      }),
      this.prisma.workflow.groupBy({
        by: ['sourceTemplateId'],
        where: { organizationId: orgId, sourceTemplateId: { not: null } },
        _count: { id: true },
      }),
      this.prisma.workflow.count({ where: { organizationId: orgId, isActive: true } }),
    ]);

    const templateIds = templateUsage
      .map((t) => t.sourceTemplateId)
      .filter((id): id is string => Boolean(id));

    const templates = templateIds.length
      ? await this.prisma.workflowTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];

    const templateMap = new Map(templates.map((t) => [t.id, t]));

    return {
      workflows: { active: workflowsActive },
      executions: {
        total: totalExecutions,
        completed,
        failed,
        dlq,
        waiting,
        retries,
        last24h,
        successRate: totalExecutions > 0 ? Math.round((completed / totalExecutions) * 100) : 0,
      },
      templates: templateUsage.map((row) => ({
        templateId: row.sourceTemplateId,
        name: templateMap.get(row.sourceTemplateId!)?.name ?? row.sourceTemplateId,
        slug: templateMap.get(row.sourceTemplateId!)?.slug,
        workflowCount: row._count.id,
      })),
    };
  }
}
