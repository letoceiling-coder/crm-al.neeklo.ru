import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateMarketplaceReviewDto } from './dto/marketplace.dto';
import { canViewPackage } from './marketplace-visibility.util';

@Injectable()
export class MarketplaceReviewService {
  constructor(private prisma: PrismaService) {}

  listForPackage(tenant: TenantContext, packageId: string) {
    return this.prisma.marketplaceReview.findMany({
      where: { packageId },
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  async create(tenant: TenantContext, dto: CreateMarketplaceReviewDto) {
    const pkg = await this.prisma.marketplacePackage.findUnique({ where: { id: dto.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (!canViewPackage(pkg, tenant.organizationId)) {
      throw new ForbiddenException('Cannot review inaccessible package');
    }
    if (pkg.organizationId === tenant.organizationId) {
      throw new BadRequestException('Cannot review your own package');
    }

    const review = await this.prisma.marketplaceReview.upsert({
      where: {
        packageId_organizationId: {
          packageId: dto.packageId,
          organizationId: tenant.organizationId,
        },
      },
      create: {
        packageId: dto.packageId,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        rating: dto.rating,
        comment: dto.comment?.trim(),
      },
      update: {
        userId: tenant.userId,
        rating: dto.rating,
        comment: dto.comment?.trim(),
      },
    });

    const agg = await this.prisma.marketplaceReview.aggregate({
      where: { packageId: dto.packageId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.marketplacePackage.update({
      where: { id: dto.packageId },
      data: {
        rating: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    return review;
  }
}
