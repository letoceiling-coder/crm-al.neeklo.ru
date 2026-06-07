import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowStepType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowStepDto } from './dto/workflow.dto';
import { WORKFLOW_MAX_STEPS } from './workflow.constants';
import { WorkflowGraphEngine } from './workflow-graph.engine';

@Injectable()
export class WorkflowService {
  private readonly graph = new WorkflowGraphEngine();

  constructor(private prisma: PrismaService) {}
  async list(tenant: TenantContext) {
    return this.prisma.workflow.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        currentVersion: {
          include: { steps: { orderBy: { position: 'asc' } } },
        },
        _count: { select: { executions: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: { steps: { orderBy: { position: 'asc' } } },
        },
        versions: { orderBy: { version: 'desc' }, take: 10 },
        executions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateWorkflowDto) {
    const steps = this.normalizeSteps(dto.steps);
    const webhookToken =
      dto.triggerType === WorkflowTriggerType.WEBHOOK
        ? randomBytes(24).toString('hex')
        : undefined;

    const workflow = await this.prisma.workflow.create({
      data: {
        organizationId: tenant.organizationId,
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConfig: (dto.triggerConfig ?? {}) as object,
        scheduleCron: dto.scheduleCron,
        scheduleTimezone: dto.scheduleTimezone ?? 'UTC',
        webhookToken,
        status: WorkflowStatus.DRAFT,
        createdById: tenant.userId,
        updatedById: tenant.userId,
      },
    });

    const version = await this.createVersion(workflow.id, 1, steps, true);
    return this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { currentVersionId: version.id },
      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
  }

  async update(tenant: TenantContext, id: string, dto: UpdateWorkflowDto) {
    await this.assertOwned(id, tenant.organizationId);
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    if (dto.steps) {
      const steps = this.normalizeSteps(dto.steps);
      const lastVersion = await this.prisma.workflowVersion.findFirst({
        where: { workflowId: id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastVersion?.version ?? 0) + 1;
      const version = await this.createVersion(id, nextVersion, steps, true);
      await this.prisma.workflow.update({
        where: { id },
        data: { currentVersionId: version.id },
      });
    }

    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.triggerConfig !== undefined ? { triggerConfig: dto.triggerConfig as object } : {}),
        ...(dto.scheduleCron !== undefined ? { scheduleCron: dto.scheduleCron } : {}),
        ...(dto.scheduleTimezone !== undefined ? { scheduleTimezone: dto.scheduleTimezone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive, status: dto.isActive ? WorkflowStatus.ACTIVE : WorkflowStatus.INACTIVE } : {}),
        updatedById: tenant.userId,
      },      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true };
  }

  async findByWebhookToken(token: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { webhookToken: token, isActive: true, triggerType: WorkflowTriggerType.WEBHOOK },
      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async findActiveByTrigger(
    organizationId: string,
    triggerType: WorkflowTriggerType,
    eventName?: string,
  ) {
    const workflows = await this.prisma.workflow.findMany({
      where: { organizationId, isActive: true, triggerType },
      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!eventName) return workflows;
    return workflows.filter((w) => {
      const cfg = (w.triggerConfig ?? {}) as { event?: string };
      return !cfg.event || cfg.event === eventName;
    });
  }

  async createFromTemplate(
    tenant: TenantContext,
    params: {
      name: string;
      description?: string;
      triggerType: WorkflowTriggerType;
      triggerConfig: Record<string, unknown>;
      scheduleCron?: string;
      steps: WorkflowStepDto[];
      graph?: Record<string, unknown>;
      sourceTemplateId: string;
    },
  ) {
    const steps = this.normalizeSteps(params.steps);
    const webhookToken =
      params.triggerType === WorkflowTriggerType.WEBHOOK
        ? randomBytes(24).toString('hex')
        : undefined;

    const workflow = await this.prisma.workflow.create({
      data: {
        organizationId: tenant.organizationId,
        name: params.name,
        description: params.description,
        triggerType: params.triggerType,
        triggerConfig: params.triggerConfig as object,
        scheduleCron: params.scheduleCron,
        scheduleTimezone: 'UTC',
        webhookToken,
        status: WorkflowStatus.DRAFT,
        sourceTemplateId: params.sourceTemplateId,
        createdById: tenant.userId,
        updatedById: tenant.userId,
      },
    });

    const version = await this.createVersion(workflow.id, 1, steps, true, params.graph);
    return this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { currentVersionId: version.id },
      include: {
        currentVersion: { include: { steps: { orderBy: { position: 'asc' } } } },
      },
    });
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.workflow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Workflow not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Workflow belongs to another organization');
    }
    return row;
  }

  private normalizeSteps(steps?: WorkflowStepDto[]) {
    const list = steps?.length
      ? [...steps].sort((a, b) => a.position - b.position)
      : [
          { stepKey: 'start', stepType: WorkflowStepType.START, position: 0, configuration: {} },
          { stepKey: 'end', stepType: WorkflowStepType.END, position: 1, configuration: {} },
        ];
    if (list.length > WORKFLOW_MAX_STEPS) {
      throw new BadRequestException(`Max ${WORKFLOW_MAX_STEPS} steps per workflow`);
    }
    return list;
  }

  private async createVersion(
    workflowId: string,
    version: number,
    steps: WorkflowStepDto[],
    published: boolean,
    graphOverride?: Record<string, unknown>,
  ) {
    const graphDef = graphOverride?.edges
      ? graphOverride
      : this.buildGraphDefinition(steps);

    const ver = await this.prisma.workflowVersion.create({
      data: {
        workflowId,
        version,
        published,
        definition: {
          steps: steps.map((s) => s.stepKey),
          edges: (graphDef as { edges?: unknown[] }).edges ?? this.graph.buildLinearEdges(steps as never),
        } as object,
      },
    });    await this.prisma.workflowStep.createMany({
      data: steps.map((s) => ({
        workflowVersionId: ver.id,
        stepType: s.stepType,
        stepKey: s.stepKey,
        configuration: (s.configuration ?? {}) as object,
        position: s.position,
      })),
    });
    return ver;
  }

  private buildGraphDefinition(steps: WorkflowStepDto[]) {
    const edges = this.graph.buildLinearEdges(steps as never);
    for (const s of steps) {
      if (s.stepType === WorkflowStepType.BRANCH) {
        const cfg = (s.configuration ?? {}) as Record<string, unknown>;
        if (cfg.trueStepKey) {
          edges.push({ from: s.stepKey, to: String(cfg.trueStepKey), condition: 'true' });
        }
        if (cfg.falseStepKey) {
          edges.push({ from: s.stepKey, to: String(cfg.falseStepKey), condition: 'false' });
        }
      }
      if (s.stepType === WorkflowStepType.CONDITION) {
        const cfg = (s.configuration ?? {}) as Record<string, unknown>;
        if (cfg.trueStepKey) {
          edges.push({ from: s.stepKey, to: String(cfg.trueStepKey), condition: 'true' });
        }
        if (cfg.falseStepKey) {
          edges.push({ from: s.stepKey, to: String(cfg.falseStepKey), condition: 'false' });
        }
      }
    }
    return { steps: steps.map((s) => s.stepKey), edges };
  }
}