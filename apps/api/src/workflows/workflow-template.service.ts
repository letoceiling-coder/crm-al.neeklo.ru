import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { WorkflowService } from './workflow.service';
import { WorkflowStepDto } from './dto/workflow.dto';

@Injectable()
export class WorkflowTemplateService {
  constructor(
    private prisma: PrismaService,
    private workflows: WorkflowService,
  ) {}

  async listCategories() {
    return this.prisma.workflowTemplateCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        templates: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async listTemplates(categorySlug?: string) {
    return this.prisma.workflowTemplate.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(id: string) {
    const tpl = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async instantiate(tenant: TenantContext, templateId: string, name?: string) {
    const tpl = await this.getTemplate(templateId);
    const steps = tpl.steps as unknown as WorkflowStepDto[];

    const workflow = await this.workflows.createFromTemplate(tenant, {
      name: name ?? tpl.name,
      description: tpl.description ?? undefined,
      triggerType: tpl.triggerType,
      triggerConfig: tpl.triggerConfig as Record<string, unknown>,
      scheduleCron: tpl.scheduleCron ?? undefined,
      steps,
      graph: tpl.graph as Record<string, unknown>,
      sourceTemplateId: tpl.id,
    });

    await this.prisma.workflowTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    return workflow;
  }
}
