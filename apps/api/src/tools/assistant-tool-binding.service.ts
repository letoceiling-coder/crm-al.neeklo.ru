import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ToolInstanceService } from './tool-instance.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { UpsertToolBindingDto, UpdateToolBindingDto } from './dto/tool.dto';

@Injectable()
export class AssistantToolBindingService {
  constructor(
    private prisma: PrismaService,
    private instances: ToolInstanceService,
  ) {}

  private async assertAssistantOwned(assistantId: string, organizationId: string) {
    const agent = await this.prisma.keyAgent.findUnique({ where: { id: assistantId } });
    if (!agent) throw new NotFoundException('Assistant not found');
    if (agent.organizationId !== organizationId) {
      throw new ForbiddenException('Assistant belongs to another organization');
    }
  }

  async list(tenant: TenantContext, assistantId: string) {
    await this.assertAssistantOwned(assistantId, tenant.organizationId);
    return this.prisma.assistantToolBinding.findMany({
      where: { assistantId, organizationId: tenant.organizationId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        toolInstance: {
          include: {
            definition: { select: { slug: true, name: true, providerType: true } },
            executionLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, createdAt: true, latencyMs: true },
            },
          },
        },
      },
    });
  }

  async upsert(tenant: TenantContext, assistantId: string, dto: UpsertToolBindingDto) {
    await this.assertAssistantOwned(assistantId, tenant.organizationId);
    await this.instances.assertOwned(dto.toolInstanceId, tenant.organizationId);

    return this.prisma.assistantToolBinding.upsert({
      where: {
        assistantId_toolInstanceId: {
          assistantId,
          toolInstanceId: dto.toolInstanceId,
        },
      },
      create: {
        organizationId: tenant.organizationId,
        assistantId,
        toolInstanceId: dto.toolInstanceId,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
        allowedActions: dto.allowedActions ?? [],
      },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.allowedActions !== undefined ? { allowedActions: dto.allowedActions } : {}),
      },
      include: {
        toolInstance: {
          include: { definition: { select: { slug: true, name: true, providerType: true } } },
        },
      },
    });
  }

  async update(
    tenant: TenantContext,
    assistantId: string,
    bindingId: string,
    dto: UpdateToolBindingDto,
  ) {
    await this.assertBindingOwned(bindingId, assistantId, tenant.organizationId);
    return this.prisma.assistantToolBinding.update({
      where: { id: bindingId },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.allowedActions !== undefined ? { allowedActions: dto.allowedActions } : {}),
      },
      include: {
        toolInstance: {
          include: { definition: { select: { slug: true, name: true, providerType: true } } },
        },
      },
    });
  }

  async remove(tenant: TenantContext, assistantId: string, bindingId: string) {
    await this.assertBindingOwned(bindingId, assistantId, tenant.organizationId);
    await this.prisma.assistantToolBinding.delete({ where: { id: bindingId } });
    return { deleted: true };
  }

  async getEnabledBindings(assistantId: string, organizationId: string) {
    return this.prisma.assistantToolBinding.findMany({
      where: { assistantId, organizationId, enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        toolInstance: {
          include: { definition: { include: { provider: true } } },
        },
      },
    });
  }

  private async assertBindingOwned(bindingId: string, assistantId: string, organizationId: string) {
    const binding = await this.prisma.assistantToolBinding.findUnique({ where: { id: bindingId } });
    if (!binding) throw new NotFoundException('Binding not found');
    if (binding.assistantId !== assistantId || binding.organizationId !== organizationId) {
      throw new ForbiddenException('Binding belongs to another assistant or organization');
    }
    return binding;
  }
}
