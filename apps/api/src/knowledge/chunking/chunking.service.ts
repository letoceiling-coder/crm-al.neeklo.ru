import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ChunkStrategyService } from './chunk-strategy.service';
import { KnowledgePlanLimitsService } from '../knowledge-plan-limits.service';
import { DEFAULT_CHUNK_SETTINGS, ChunkSettings } from './chunk.types';
import { KnowledgeEmbeddingStatus } from '@prisma/client';

@Injectable()
export class ChunkingService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private strategies: ChunkStrategyService,
    private limits: KnowledgePlanLimitsService,
  ) {}

  resolveSettings(kbSettings: unknown): ChunkSettings {
    const s = (kbSettings ?? {}) as Partial<ChunkSettings>;
    return { ...DEFAULT_CHUNK_SETTINGS, ...s };
  }

  async chunkDocument(params: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId: string;
    versionId?: string;
  }): Promise<{ chunkIds: string[]; versionId: string }> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: params.documentId },
      include: {
        knowledgeBase: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!doc || doc.organizationId !== params.organizationId) {
      throw new NotFoundException('Document not found');
    }
    if (doc.status !== 'READY') {
      return { chunkIds: [], versionId: '' };
    }

    const version =
      params.versionId != null
        ? await this.prisma.knowledgeDocumentVersion.findUnique({ where: { id: params.versionId } })
        : doc.versions[0];
    if (!version) throw new NotFoundException('Document version not found');

    const settings = this.resolveSettings(doc.knowledgeBase.settings);
    const text = await this.loadVersionText(version.s3Key);

    await this.prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { embeddingStatus: KnowledgeEmbeddingStatus.CHUNKING },
    });

    await this.deleteChunksForVersion(doc.id, version.id);

    const pieces = this.strategies.split(text, settings);
    await this.limits.assertCanCreateChunks(params.organizationId, pieces.length);

    const chunkIds: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const chunk = await this.prisma.knowledgeChunk.create({
        data: {
          organizationId: params.organizationId,
          knowledgeBaseId: params.knowledgeBaseId,
          documentId: doc.id,
          versionId: version.id,
          chunkIndex: i,
          content: piece.content,
          charCount: piece.charCount,
          tokenCount: piece.tokenCount,
          metadata: (piece.metadata ?? {}) as object,
        },
      });
      chunkIds.push(chunk.id);
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: {
        chunkCount: chunkIds.length,
        embeddingStatus: KnowledgeEmbeddingStatus.EMBEDDING,
      },
    });

    return { chunkIds, versionId: version.id };
  }

  private async loadVersionText(s3Key: string): Promise<string> {
    const buffer = await this.storage.download(s3Key);
    return buffer.toString('utf-8');
  }

  private async deleteChunksForVersion(documentId: string, versionId: string) {
    await this.prisma.knowledgeChunk.deleteMany({
      where: { documentId, versionId },
    });
  }
}
