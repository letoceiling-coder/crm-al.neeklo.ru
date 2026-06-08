import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { marketplaceBrowseWhere } from './marketplace-visibility.util';

const packageInclude = {
  category: { select: { id: true, slug: true, name: true } },
  author: { select: { id: true, name: true, email: true } },
  organization: { select: { id: true, name: true, slug: true } },
  _count: { select: { reviews: true, installsLog: true, versions: true } },
} satisfies Prisma.MarketplacePackageInclude;

@Injectable()
export class MarketplaceFeaturedService {
  constructor(private prisma: PrismaService) {}

  async getFeatured(organizationId: string, limit = 12) {
    const base = marketplaceBrowseWhere(organizationId);
    const take = Math.min(limit, 50);

    const [featured, popular, newest, topRated, mostInstalled] = await Promise.all([
      this.prisma.marketplacePackage.findMany({
        where: { ...base, isFeatured: true },
        orderBy: { updatedAt: 'desc' },
        take,
        include: packageInclude,
      }),
      this.prisma.marketplacePackage.findMany({
        where: base,
        orderBy: { downloads: 'desc' },
        take,
        include: packageInclude,
      }),
      this.prisma.marketplacePackage.findMany({
        where: base,
        orderBy: { createdAt: 'desc' },
        take,
        include: packageInclude,
      }),
      this.prisma.marketplacePackage.findMany({
        where: { ...base, ratingCount: { gt: 0 } },
        orderBy: { rating: 'desc' },
        take,
        include: packageInclude,
      }),
      this.prisma.marketplacePackage.findMany({
        where: base,
        orderBy: { installs: 'desc' },
        take,
        include: packageInclude,
      }),
    ]);

    return { featured, popular, newest, topRated, mostInstalled };
  }
}

@Injectable()
export class MarketplaceAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getPackageAnalytics(packageId: string, organizationId: string) {
    const pkg = await this.prisma.marketplacePackage.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.organizationId !== organizationId) {
      throw new NotFoundException('Package not found');
    }

    const [activeInstalls, versionDistribution, recentInstalls] = await Promise.all([
      this.prisma.marketplaceInstall.count({
        where: { packageId, status: 'ACTIVE' },
      }),
      this.prisma.marketplaceInstall.groupBy({
        by: ['versionId'],
        where: { packageId, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.marketplaceInstall.findMany({
        where: { packageId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          createdAt: true,
          installedOrganizationId: true,
          version: { select: { version: true } },
        },
      }),
    ]);

    const versionIds = versionDistribution.map((v) => v.versionId);
    const versions = versionIds.length
      ? await this.prisma.marketplaceVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, version: true },
        })
      : [];
    const versionMap = new Map(versions.map((v) => [v.id, v.version]));

    return {
      downloads: pkg.downloads,
      installs: pkg.installs,
      activeInstalls,
      rating: pkg.rating,
      ratingCount: pkg.ratingCount,
      versionDistribution: versionDistribution.map((row) => ({
        version: versionMap.get(row.versionId) ?? row.versionId,
        count: row._count._all,
      })),
      recentInstalls,
    };
  }
}
