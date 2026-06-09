import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeHistoryEventType } from '@prisma/client';

export interface RecordEventParams {
  organizationId: string;
  knowledgeBaseId: string;
  documentId?: string;
  eventType: KnowledgeHistoryEventType;
  actorId?: string;
  actorEmail?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class KnowledgeHistoryService {
  private readonly logger = new Logger(KnowledgeHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordEventParams): Promise<void> {
    try {
      await this.prisma.knowledgeHistoryEvent.create({
        data: {
          organizationId: params.organizationId,
          knowledgeBaseId: params.knowledgeBaseId,
          documentId: params.documentId ?? null,
          eventType: params.eventType,
          actorId: params.actorId ?? null,
          actorEmail: params.actorEmail ?? null,
          data: (params.data ?? {}) as object,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record history event: ${(err as Error).message}`);
    }
  }

  async list(
    organizationId: string,
    knowledgeBaseId: string,
    options?: { documentId?: string; limit?: number; offset?: number },
  ) {
    const where = {
      organizationId,
      knowledgeBaseId,
      ...(options?.documentId ? { documentId: options.documentId } : {}),
    };

    const [total, events] = await Promise.all([
      this.prisma.knowledgeHistoryEvent.count({ where }),
      this.prisma.knowledgeHistoryEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
        include: {
          document: { select: { id: true, title: true, format: true } },
        },
      }),
    ]);

    return { total, events };
  }
}
