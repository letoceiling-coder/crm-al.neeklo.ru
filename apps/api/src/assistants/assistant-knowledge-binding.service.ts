import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KeyAgentService } from './key-agent.service';
import { KnowledgeBaseService } from '../knowledge/knowledge-base.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import {
  UpsertKnowledgeBindingDto,
  UpdateKnowledgeBindingDto,
} from './dto/assistant-knowledge-binding.dto';

@Injectable()
export class AssistantKnowledgeBindingService {
  constructor(
    private prisma: PrismaService,
    private keyAgents: KeyAgentService,
    private kb: KnowledgeBaseService,
  ) {}

  async list(tenant: TenantContext, assistantId: string) {
    await this.keyAgents.assertOwned(assistantId, tenant.organizationId);
    return this.prisma.assistantKnowledgeBinding.findMany({
      where: { assistantId, organizationId: tenant.organizationId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        knowledgeBase: {
          select: { id: true, name: true, slug: true, status: true, embeddingProfileId: true },
        },
      },
    });
  }

  async upsert(tenant: TenantContext, assistantId: string, dto: UpsertKnowledgeBindingDto) {
    await this.keyAgents.assertOwned(assistantId, tenant.organizationId);
    await this.kb.assertOwned(dto.knowledgeBaseId, tenant.organizationId);

    return this.prisma.assistantKnowledgeBinding.upsert({
      where: {
        assistantId_knowledgeBaseId: {
          assistantId,
          knowledgeBaseId: dto.knowledgeBaseId,
        },
      },
      create: {
        organizationId: tenant.organizationId,
        assistantId,
        knowledgeBaseId: dto.knowledgeBaseId,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
        maxChunks: dto.maxChunks ?? 5,
        maxTokens: dto.maxTokens ?? 2000,
        searchMode: dto.searchMode ?? 'HYBRID',
        keywordWeight: dto.keywordWeight ?? 0.3,
        vectorWeight: dto.vectorWeight ?? 0.7,
      },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.maxChunks !== undefined ? { maxChunks: dto.maxChunks } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.searchMode !== undefined ? { searchMode: dto.searchMode } : {}),
        ...(dto.keywordWeight !== undefined ? { keywordWeight: dto.keywordWeight } : {}),
        ...(dto.vectorWeight !== undefined ? { vectorWeight: dto.vectorWeight } : {}),
      },
      include: {
        knowledgeBase: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
  }

  async update(
    tenant: TenantContext,
    assistantId: string,
    bindingId: string,
    dto: UpdateKnowledgeBindingDto,
  ) {
    const binding = await this.assertBindingOwned(bindingId, assistantId, tenant.organizationId);
    return this.prisma.assistantKnowledgeBinding.update({
      where: { id: binding.id },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.maxChunks !== undefined ? { maxChunks: dto.maxChunks } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.searchMode !== undefined ? { searchMode: dto.searchMode } : {}),
        ...(dto.keywordWeight !== undefined ? { keywordWeight: dto.keywordWeight } : {}),
        ...(dto.vectorWeight !== undefined ? { vectorWeight: dto.vectorWeight } : {}),
      },
      include: {
        knowledgeBase: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
  }

  async remove(tenant: TenantContext, assistantId: string, bindingId: string) {
    await this.assertBindingOwned(bindingId, assistantId, tenant.organizationId);
    await this.prisma.assistantKnowledgeBinding.delete({ where: { id: bindingId } });
    return { deleted: true };
  }

  async getEnabledBindings(assistantId: string, organizationId: string) {
    return this.prisma.assistantKnowledgeBinding.findMany({
      where: { assistantId, organizationId, enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        knowledgeBase: {
          select: { id: true, name: true, slug: true, embeddingProfileId: true },
        },
      },
    });
  }

  private async assertBindingOwned(bindingId: string, assistantId: string, organizationId: string) {
    const binding = await this.prisma.assistantKnowledgeBinding.findUnique({
      where: { id: bindingId },
    });
    if (!binding) throw new NotFoundException('Binding not found');
    if (binding.assistantId !== assistantId || binding.organizationId !== organizationId) {
      throw new ForbiddenException('Binding belongs to another assistant or organization');
    }
    return binding;
  }
}
