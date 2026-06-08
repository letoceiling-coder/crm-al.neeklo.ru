import { Injectable, BadRequestException } from '@nestjs/common';
import {
  AgentStatus,
  AgentType,
  KnowledgeBaseStatus,
  Prisma,
  WorkflowStatus,
  WorkflowStepType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { slugify } from '../common/utils/slug.util';
import { ToolCatalogService } from '../tools/tool-catalog.service';
import {
  ClonedEntities,
  MarketplaceManifest,
  MarketplaceManifestWorkflowStep,
} from './marketplace.types';

const DEFAULT_KB_STATS = { documents: 0, chunks: 0, sources: 0, storageBytes: 0 };

@Injectable()
export class MarketplaceCloneService {
  constructor(
    private prisma: PrismaService,
    private toolCatalog: ToolCatalogService,
  ) {}

  async cloneManifest(tenant: TenantContext, manifest: MarketplaceManifest): Promise<ClonedEntities> {
    const cloned: ClonedEntities = {};

    if (manifest.assistant) {
      cloned.assistantId = await this.cloneAssistant(tenant, manifest);
    }
    if (manifest.workflow) {
      cloned.workflowId = await this.cloneWorkflow(tenant, manifest);
    }
    if (manifest.tools?.length) {
      cloned.toolInstanceIds = await this.cloneTools(tenant, manifest);
    }
    if (manifest.knowledgeTemplate) {
      cloned.knowledgeBaseId = await this.cloneKnowledgeTemplate(tenant, manifest);
    }

    return cloned;
  }

  validateCloneResult(manifest: MarketplaceManifest, cloned: ClonedEntities) {
    if (manifest.assistant && !cloned.assistantId) {
      throw new BadRequestException('Assistant clone failed');
    }
    if (manifest.workflow && !cloned.workflowId) {
      throw new BadRequestException('Workflow clone failed');
    }
    if (manifest.tools?.length && !cloned.toolInstanceIds?.length) {
      throw new BadRequestException('Tool clone failed');
    }
    if (manifest.knowledgeTemplate && !cloned.knowledgeBaseId) {
      throw new BadRequestException('Knowledge template clone failed');
    }
  }

  private async cloneAssistant(tenant: TenantContext, manifest: MarketplaceManifest) {
    const src = manifest.assistant!;
    const baseSlug = slugify(src.name);
    const slug = await this.ensureUniqueAgentSlug(tenant.organizationId, baseSlug);

    const agent = await this.prisma.keyAgent.create({
      data: {
        organizationId: tenant.organizationId,
        templateId: null,
        name: src.name,
        slug,
        description: src.description,
        agentType: src.agentType ?? AgentType.ASSISTANT,
        status: AgentStatus.DRAFT,
        systemPrompt: src.systemPrompt,
        settings: (src.settings ?? {}) as Prisma.InputJsonValue,
        createdBy: tenant.userId,
        updatedBy: tenant.userId,
      },
    });

    if (src.variables?.length) {
      await this.prisma.agentVariable.createMany({
        data: src.variables.map((v) => ({
          keyAgentId: agent.id,
          key: v.key,
          value: v.value,
        })),
        skipDuplicates: true,
      });
    }

    return agent.id;
  }

  private async cloneWorkflow(tenant: TenantContext, manifest: MarketplaceManifest) {
    const src = manifest.workflow!;
    const steps = this.normalizeSteps(src.steps);
    const webhookToken = src.triggerType === 'WEBHOOK' ? randomBytes(24).toString('hex') : undefined;

    const workflow = await this.prisma.workflow.create({
      data: {
        organizationId: tenant.organizationId,
        name: src.name,
        description: src.description,
        triggerType: src.triggerType,
        triggerConfig: src.triggerConfig as Prisma.InputJsonValue,
        scheduleCron: src.scheduleCron,
        scheduleTimezone: 'UTC',
        webhookToken,
        status: WorkflowStatus.DRAFT,
        sourceTemplateId: null,
        createdById: tenant.userId,
        updatedById: tenant.userId,
      },
    });

    const version = await this.prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        version: 1,
        published: false,
        definition: {
          steps: steps.map((s) => s.stepKey),
          edges: (src.graph as { edges?: unknown[] })?.edges ?? steps.slice(0, -1).map((s, i) => ({
            from: s.stepKey,
            to: steps[i + 1]?.stepKey,
          })),
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.workflowStep.createMany({
      data: steps.map((s) => ({
        workflowVersionId: version.id,
        stepKey: s.stepKey,
        stepType: s.stepType,
        position: s.position,
        configuration: (s.configuration ?? {}) as Prisma.InputJsonValue,
      })),
    });

    await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { currentVersionId: version.id },
    });

    return workflow.id;
  }

  private async cloneTools(tenant: TenantContext, manifest: MarketplaceManifest) {
    const ids: string[] = [];
    for (const tool of manifest.tools ?? []) {
      const definition = await this.toolCatalog.getBySlug(tool.definitionSlug);
      const instance = await this.prisma.toolInstance.create({
        data: {
          organizationId: tenant.organizationId,
          toolDefinitionId: definition.id,
          name: tool.name,
          settings: (tool.settings ?? {}) as Prisma.InputJsonValue,
        },
      });
      ids.push(instance.id);
    }
    return ids;
  }

  private async cloneKnowledgeTemplate(tenant: TenantContext, manifest: MarketplaceManifest) {
    const src = manifest.knowledgeTemplate!;
    const baseSlug = slugify(src.name);
    const slug = await this.ensureUniqueKbSlug(tenant.organizationId, baseSlug);

    const kb = await this.prisma.knowledgeBase.create({
      data: {
        organizationId: tenant.organizationId,
        createdBy: tenant.userId,
        name: src.name,
        slug,
        description: src.description,
        status: KnowledgeBaseStatus.DRAFT,
        stats: DEFAULT_KB_STATS as Prisma.InputJsonValue,
      },
    });

    return kb.id;
  }

  private normalizeSteps(steps: MarketplaceManifestWorkflowStep[]) {
    const list = [...steps].sort((a, b) => a.position - b.position);
    if (!list.some((s) => s.stepType === WorkflowStepType.START)) {
      list.unshift({
        stepKey: 'start',
        stepType: WorkflowStepType.START,
        position: 0,
        configuration: {},
      });
    }
    if (!list.some((s) => s.stepType === WorkflowStepType.END)) {
      list.push({
        stepKey: 'end',
        stepType: WorkflowStepType.END,
        position: list.length,
        configuration: {},
      });
    }
    return list;
  }

  private async ensureUniqueAgentSlug(orgId: string, base: string) {
    let slug = base;
    let i = 0;
    while (await this.prisma.keyAgent.findUnique({ where: { organizationId_slug: { organizationId: orgId, slug } } })) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return slug;
  }

  private async ensureUniqueKbSlug(orgId: string, base: string) {
    let slug = base;
    let i = 0;
    while (
      await this.prisma.knowledgeBase.findFirst({ where: { organizationId: orgId, slug } })
    ) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
