import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeJobStatus } from '@prisma/client';

@Injectable()
export class KnowledgePlanLimitsService {
  constructor(private prisma: PrismaService) {}

  private async limits(organizationId: string) {
    return (
      (await this.prisma.planLimits.findUnique({ where: { organizationId } })) ?? {
        maxKnowledgeBases: 5,
        maxDocuments: 1000,
        maxChunks: 100000,
        maxStorageMb: 5120,
        maxSources: 50,
        maxJobs: 500,
        maxUrlsPerSitemap: 500,
      }
    );
  }

  async assertCanCreateKnowledgeBase(organizationId: string) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.knowledgeBase.count({ where: { organizationId } });
    if (count >= lim.maxKnowledgeBases) {
      throw new BadRequestException(`Лимит баз знаний: ${lim.maxKnowledgeBases}`);
    }
  }

  async assertCanCreateDocument(organizationId: string, knowledgeBaseId: string) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.knowledgeDocument.count({
      where: { organizationId, knowledgeBaseId },
    });
    if (count >= lim.maxDocuments) {
      throw new BadRequestException(`Лимит документов: ${lim.maxDocuments}`);
    }
  }

  async assertCanCreateSource(organizationId: string) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.knowledgeSource.count({ where: { organizationId } });
    if (count >= lim.maxSources) {
      throw new BadRequestException(`Лимит источников: ${lim.maxSources}`);
    }
  }

  async assertCanCreateJob(organizationId: string) {
    const lim = await this.limits(organizationId);
    const active = await this.prisma.knowledgeJob.count({
      where: {
        organizationId,
        status: { in: [KnowledgeJobStatus.QUEUED, KnowledgeJobStatus.RUNNING] },
      },
    });
    if (active >= lim.maxJobs) {
      throw new BadRequestException(`Лимит активных задач: ${lim.maxJobs}`);
    }
  }

  async getMaxUrlsPerSitemap(organizationId: string): Promise<number> {
    const lim = await this.limits(organizationId);
    return lim.maxUrlsPerSitemap;
  }

  async assertStorageWithinLimit(organizationId: string, additionalBytes: number) {
    const lim = await this.limits(organizationId);
    const maxBytes = lim.maxStorageMb * 1024 * 1024;
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { organizationId },
      select: { parserChars: true },
    });
    const approxBytes = docs.reduce((s, d) => s + (d.parserChars ?? 0) * 2, 0) + additionalBytes;
    if (approxBytes > maxBytes) {
      throw new BadRequestException(`Лимит хранилища: ${lim.maxStorageMb} MB`);
    }
  }

  async assertCanCreateChunks(organizationId: string, additionalChunks: number) {
    const lim = await this.limits(organizationId);
    const count = await this.prisma.knowledgeChunk.count({ where: { organizationId } });
    if (count + additionalChunks > lim.maxChunks) {
      throw new BadRequestException(`Лимит чанков: ${lim.maxChunks}`);
    }
  }
}
