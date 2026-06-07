import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { skipTake, paginate } from '../common/utils/pagination.util';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    action: AuditAction,
    userId?: string | null,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
    entityType?: string,
    entityId?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? undefined,
        details: details as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
        entityType,
        entityId,
      },
    });
  }

  async findAll(query: PaginationQueryDto, filters?: { action?: AuditAction; userId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.action) where.action = filters.action;
    if (filters?.userId) where.userId = filters.userId;

    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, query);
  }
}
