import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolCatalogService {
  constructor(private prisma: PrismaService) {}

  listDefinitions() {
    return this.prisma.toolDefinition.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { name: 'asc' },
      include: {
        provider: { select: { id: true, slug: true, name: true, providerType: true } },
      },
    });
  }

  async getBySlug(slug: string) {
    const def = await this.prisma.toolDefinition.findFirst({
      where: { slug, isActive: true, isPublic: true },
      include: {
        provider: { select: { id: true, slug: true, name: true, providerType: true, endpoint: true } },
      },
    });
    if (!def) throw new NotFoundException('Tool definition not found');
    return def;
  }

  listProviders() {
    return this.prisma.toolProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { definitions: true } } },
    });
  }
}
