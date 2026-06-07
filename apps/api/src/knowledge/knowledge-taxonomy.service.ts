import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { slugify } from './knowledge.utils';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateTopicDto,
  UpdateTopicDto,
  CreateTagDto,
  AssignDocumentTagsDto,
} from './dto/knowledge-taxonomy.dto';

@Injectable()
export class KnowledgeTaxonomyService {
  constructor(
    private prisma: PrismaService,
    private kb: KnowledgeBaseService,
  ) {}

  // ─── Categories ───────────────────────────────────────────────────────────

  async listCategories(tenant: TenantContext, knowledgeBaseId: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.prisma.knowledgeCategory.findMany({
      where: { knowledgeBaseId, organizationId: tenant.organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { documents: true, topics: true, children: true } },
        children: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async createCategory(tenant: TenantContext, dto: CreateCategoryDto) {
    await this.kb.assertOwned(dto.knowledgeBaseId, tenant.organizationId);
    const slug = dto.slug?.trim() || slugify(dto.name);
    return this.prisma.knowledgeCategory.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        parentId: dto.parentId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(tenant: TenantContext, id: string, dto: UpdateCategoryDto) {
    await this.assertCategoryOwned(id, tenant.organizationId);
    return this.prisma.knowledgeCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async removeCategory(tenant: TenantContext, id: string) {
    await this.assertCategoryOwned(id, tenant.organizationId);
    await this.prisma.knowledgeCategory.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Topics ───────────────────────────────────────────────────────────────

  async listTopics(tenant: TenantContext, knowledgeBaseId: string, categoryId?: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.prisma.knowledgeTopic.findMany({
      where: {
        knowledgeBaseId,
        organizationId: tenant.organizationId,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } }, _count: { select: { documents: true } } },
    });
  }

  async createTopic(tenant: TenantContext, dto: CreateTopicDto) {
    await this.kb.assertOwned(dto.knowledgeBaseId, tenant.organizationId);
    await this.assertCategoryOwned(dto.categoryId, tenant.organizationId);
    const slug = dto.slug?.trim() || slugify(dto.name);
    return this.prisma.knowledgeTopic.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
      },
    });
  }

  async updateTopic(tenant: TenantContext, id: string, dto: UpdateTopicDto) {
    await this.assertTopicOwned(id, tenant.organizationId);
    return this.prisma.knowledgeTopic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  async removeTopic(tenant: TenantContext, id: string) {
    await this.assertTopicOwned(id, tenant.organizationId);
    await this.prisma.knowledgeTopic.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Tags ─────────────────────────────────────────────────────────────────

  async listTags(tenant: TenantContext, knowledgeBaseId: string) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.prisma.knowledgeTag.findMany({
      where: { knowledgeBaseId, organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { documents: true } } },
    });
  }

  async createTag(tenant: TenantContext, dto: CreateTagDto) {
    await this.kb.assertOwned(dto.knowledgeBaseId, tenant.organizationId);
    const slug = dto.slug?.trim() || slugify(dto.name);
    return this.prisma.knowledgeTag.create({
      data: {
        organizationId: tenant.organizationId,
        knowledgeBaseId: dto.knowledgeBaseId,
        name: dto.name.trim(),
        slug,
      },
    });
  }

  async removeTag(tenant: TenantContext, id: string) {
    await this.assertTagOwned(id, tenant.organizationId);
    await this.prisma.knowledgeTag.delete({ where: { id } });
    return { deleted: true };
  }

  async assignTags(tenant: TenantContext, documentId: string, dto: AssignDocumentTagsDto) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.organizationId !== tenant.organizationId) {
      throw new ForbiddenException('Document belongs to another organization');
    }

    const tags = await this.prisma.knowledgeTag.findMany({
      where: {
        id: { in: dto.tagIds },
        knowledgeBaseId: doc.knowledgeBaseId,
        organizationId: tenant.organizationId,
      },
    });
    if (tags.length !== dto.tagIds.length) {
      throw new BadRequestException('Invalid tag ids for this knowledge base');
    }

    await this.prisma.knowledgeDocumentTag.deleteMany({ where: { documentId } });
    await this.prisma.knowledgeDocumentTag.createMany({
      data: dto.tagIds.map((tagId) => ({ documentId, tagId })),
    });

    return this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { tags: { include: { tag: true } } },
    });
  }

  private async assertCategoryOwned(id: string, organizationId: string) {
    const row = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
    if (row.organizationId !== organizationId) throw new ForbiddenException();
    return row;
  }

  private async assertTopicOwned(id: string, organizationId: string) {
    const row = await this.prisma.knowledgeTopic.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Topic not found');
    if (row.organizationId !== organizationId) throw new ForbiddenException();
    return row;
  }

  private async assertTagOwned(id: string, organizationId: string) {
    const row = await this.prisma.knowledgeTag.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Tag not found');
    if (row.organizationId !== organizationId) throw new ForbiddenException();
    return row;
  }
}
