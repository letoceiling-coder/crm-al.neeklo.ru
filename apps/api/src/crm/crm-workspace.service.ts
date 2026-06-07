import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class CrmWorkspaceService {
  constructor(private prisma: PrismaService) {}

  async ensureWorkspace(organizationId: string) {
    return this.prisma.crmWorkspace.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId, name: 'CRM' },
    });
  }

  async getOverview(tenant: TenantContext) {
    const ws = await this.ensureWorkspace(tenant.organizationId);
    const [clients, leads, deals, tasks] = await Promise.all([
      this.prisma.crmClient.count({ where: { organizationId: tenant.organizationId } }),
      this.prisma.crmLead.count({ where: { organizationId: tenant.organizationId } }),
      this.prisma.crmDeal.count({ where: { organizationId: tenant.organizationId } }),
      this.prisma.crmTask.count({
        where: { organizationId: tenant.organizationId, status: { not: 'DONE' } },
      }),
    ]);

    const pipeline = await this.prisma.crmLead.groupBy({
      by: ['status'],
      where: { organizationId: tenant.organizationId },
      _count: { id: true },
    });

    return {
      workspace: ws,
      counts: { clients, leads, deals, tasks },
      pipeline: pipeline.map((p) => ({ stage: p.status, count: p._count.id })),
    };
  }
}
