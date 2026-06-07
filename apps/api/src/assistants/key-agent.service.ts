import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTemplateService } from './agent-template.service';
import { MemoryProfileService } from '../memory/memory-profile.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateKeyAgentDto, ListAssistantsQueryDto, UpdateKeyAgentDto } from './dto/key-agent.dto';
import { AgentStatus, Prisma } from '@prisma/client';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'assistant'
  );
}

@Injectable()
export class KeyAgentService {
  constructor(
    private prisma: PrismaService,
    private templates: AgentTemplateService,
    @Optional() @Inject(forwardRef(() => MemoryProfileService))
    private memoryProfiles?: MemoryProfileService,
  ) {}

  private async ensureUniqueSlug(organizationId: string, base: string): Promise<string> {
    let slug = base;
    let n = 0;
    while (
      await this.prisma.keyAgent.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
      })
    ) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }

  async assertOwned(id: string, organizationId: string) {
    const agent = await this.prisma.keyAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Assistant not found');
    if (agent.organizationId !== organizationId) {
      throw new ForbiddenException('Assistant belongs to another organization');
    }
    return agent;
  }

  async findAll(tenant: TenantContext, query: ListAssistantsQueryDto) {
    const where: Prisma.KeyAgentWhereInput = { organizationId: tenant.organizationId };
    if (query.agentType) where.agentType = query.agentType;
    if (query.status) where.status = query.status;

    return this.prisma.keyAgent.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, slug: true, agentType: true } },
        _count: { select: { agentApiKeys: true, variables: true } },
      },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.keyAgent.findUnique({
      where: { id },
      include: {
        template: true,
        variables: { orderBy: { key: 'asc' } },
        agentApiKeys: {
          select: {
            id: true,
            name: true,
            environment: true,
            scopes: true,
            keyPrefix: true,
            status: true,
            expiresAt: true,
            revokedAt: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateKeyAgentDto) {
    const limits = await this.prisma.planLimits.findUnique({
      where: { organizationId: tenant.organizationId },
    });
    const maxAssistants = limits?.maxAssistants ?? 10;
    const count = await this.prisma.keyAgent.count({
      where: { organizationId: tenant.organizationId },
    });
    if (count >= maxAssistants) {
      throw new BadRequestException(`Plan limit reached: max ${maxAssistants} assistants`);
    }

    let agentType = dto.agentType;
    let settings = dto.settings ?? {};
    const templateId = dto.templateId;
    const systemPrompt = dto.systemPrompt;

    if (!templateId && (!systemPrompt || systemPrompt.trim().length === 0)) {
      throw new BadRequestException('systemPrompt or templateId is required');
    }

    let resolvedPrompt = systemPrompt ?? '';

    if (templateId) {
      const template = await this.templates.findById(templateId);
      if (!resolvedPrompt || resolvedPrompt.trim().length === 0) {
        resolvedPrompt = template.defaultPrompt;
      }
      agentType = agentType ?? template.agentType;
      settings = { ...(template.defaultSettings as object), ...settings };
      await this.templates.incrementInstallCount(templateId);
    }

    const baseSlug = dto.slug ?? slugify(dto.name);
    const slug = await this.ensureUniqueSlug(tenant.organizationId, baseSlug);

    const agent = await this.prisma.keyAgent.create({
      data: {
        organizationId: tenant.organizationId,
        templateId,
        name: dto.name,
        slug,
        description: dto.description,
        agentType: agentType ?? 'ASSISTANT',
        status: dto.status ?? AgentStatus.DRAFT,
        systemPrompt: resolvedPrompt,
        settings: settings as Prisma.InputJsonValue,
        createdBy: tenant.userId,
        updatedBy: tenant.userId,
      },
      include: {
        template: { select: { id: true, name: true, slug: true } },
      },
    });

    void this.memoryProfiles?.ensureAssistantProfile(
      tenant.organizationId,
      agent.id,
      agent.name,
    );

    return agent;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateKeyAgentDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.keyAgent.update({
      where: { id },
      data: {
        ...dto,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
        updatedBy: tenant.userId,
      },
    });
  }

  async remove(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    await this.prisma.keyAgent.delete({ where: { id } });
    return { deleted: true, id };
  }
}
