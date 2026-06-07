import { Injectable } from '@nestjs/common';
import { MessageDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async create(params: {
    conversationId: string;
    direction: MessageDirection;
    content: string;
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: params.direction,
        content: params.content,
        attachments: (params.attachments ?? []) as object,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  }

  async listByConversation(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
