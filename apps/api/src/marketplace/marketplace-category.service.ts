import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketplaceCategoryService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.marketplaceCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.marketplaceCategory.findUnique({ where: { slug } });
  }
}
