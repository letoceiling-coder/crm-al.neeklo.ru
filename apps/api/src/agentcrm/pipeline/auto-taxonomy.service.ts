import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../common/utils/slug.util';
import { EnrichmentPipelineContext } from './pipeline-context.types';

/**
 * Automatically materialises category + topic from classificationJson
 * into knowledge_categories / knowledge_topics and links the document.
 * Called after persistDocumentEnrichment — no LLM calls, idempotent upserts.
 */
@Injectable()
export class AutoTaxonomyService {
  private readonly logger = new Logger(AutoTaxonomyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyFromContext(ctx: EnrichmentPipelineContext): Promise<void> {
    const cls = ctx.classificationJson;
    if (!cls) return;

    const categoryName = this.pickName(cls.category, cls.categories);
    const topicName = this.pickName(cls.topic, cls.topics);

    if (!categoryName) return;

    try {
      const categorySlug = slugify(categoryName);

      const category = await this.prisma.knowledgeCategory.upsert({
        where: {
          knowledgeBaseId_slug: {
            knowledgeBaseId: ctx.knowledgeBaseId,
            slug: categorySlug,
          },
        },
        create: {
          organizationId: ctx.organizationId,
          knowledgeBaseId: ctx.knowledgeBaseId,
          name: categoryName,
          slug: categorySlug,
        },
        update: {},
      });

      let topicId: string | undefined;

      if (topicName) {
        const topicSlug = slugify(topicName);
        const topic = await this.prisma.knowledgeTopic.upsert({
          where: {
            knowledgeBaseId_slug: {
              knowledgeBaseId: ctx.knowledgeBaseId,
              slug: topicSlug,
            },
          },
          create: {
            organizationId: ctx.organizationId,
            knowledgeBaseId: ctx.knowledgeBaseId,
            categoryId: category.id,
            name: topicName,
            slug: topicSlug,
          },
          update: {},
        });
        topicId = topic.id;
      }

      await this.prisma.knowledgeDocument.update({
        where: { id: ctx.documentId },
        data: {
          categoryId: category.id,
          ...(topicId ? { topicId } : {}),
        },
      });

      this.logger.log(
        `AutoTaxonomy applied: doc=${ctx.documentId} category="${categoryName}" topic="${topicName || '-'}"`,
      );
    } catch (err) {
      this.logger.warn(
        `AutoTaxonomy failed for doc=${ctx.documentId}: ${(err as Error).message}`,
      );
    }
  }

  private pickName(
    single: unknown,
    list: unknown,
  ): string {
    if (typeof single === 'string' && single.trim()) return single.trim();
    if (Array.isArray(list) && typeof list[0] === 'string' && (list[0] as string).trim()) {
      return (list[0] as string).trim();
    }
    return '';
  }
}
