import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketplaceInstallStatus, MarketplacePackageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { InstallMarketplacePackageDto } from './dto/marketplace.dto';
import { MarketplaceManifest } from './marketplace.types';
import { canViewPackage } from './marketplace-visibility.util';
import { MarketplaceCloneService } from './marketplace-clone.service';

@Injectable()
export class MarketplaceInstallService {
  constructor(
    private prisma: PrismaService,
    private clone: MarketplaceCloneService,
  ) {}

  listInstalled(tenant: TenantContext) {
    return this.prisma.marketplaceInstall.findMany({
      where: { installedOrganizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        package: {
          include: {
            category: { select: { slug: true, name: true } },
            author: { select: { id: true, name: true } },
          },
        },
        version: { select: { id: true, version: true, changelog: true } },
      },
    });
  }

  async install(tenant: TenantContext, dto: InstallMarketplacePackageDto) {
    const pkg = await this.prisma.marketplacePackage.findUnique({ where: { id: dto.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.status !== MarketplacePackageStatus.PUBLISHED) {
      throw new BadRequestException('Package is not published');
    }
    if (!canViewPackage(pkg, tenant.organizationId)) {
      throw new ForbiddenException('Package not accessible');
    }

    const versionRow = dto.version
      ? await this.prisma.marketplaceVersion.findUnique({
          where: { packageId_version: { packageId: pkg.id, version: dto.version } },
        })
      : await this.prisma.marketplaceVersion.findFirst({
          where: { packageId: pkg.id, publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
        });

    if (!versionRow) {
      throw new NotFoundException('Package version not found');
    }

    const manifest = versionRow.manifest as unknown as MarketplaceManifest;
    manifest.type = manifest.type ?? pkg.type;

    const existing = await this.prisma.marketplaceInstall.findFirst({
      where: {
        packageId: pkg.id,
        installedOrganizationId: tenant.organizationId,
        status: MarketplaceInstallStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new BadRequestException('Package already installed in this organization');
    }

    let installRecord = await this.prisma.marketplaceInstall.create({
      data: {
        packageId: pkg.id,
        versionId: versionRow.id,
        installedOrganizationId: tenant.organizationId,
        installedById: tenant.userId,
        status: MarketplaceInstallStatus.ACTIVE,
        clonedEntities: {},
      },
    });

    try {
      const clonedEntities = await this.clone.cloneManifest(tenant, manifest);
      this.clone.validateCloneResult(manifest, clonedEntities);

      installRecord = await this.prisma.marketplaceInstall.update({
        where: { id: installRecord.id },
        data: { clonedEntities: clonedEntities as object },
        include: {
          package: { select: { id: true, name: true, slug: true, type: true } },
          version: { select: { version: true } },
        },
      });

      await this.prisma.marketplacePackage.update({
        where: { id: pkg.id },
        data: { installs: { increment: 1 } },
      });

      return {
        install: installRecord,
        clonedEntities,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Install failed';
      await this.prisma.marketplaceInstall.update({
        where: { id: installRecord.id },
        data: { status: MarketplaceInstallStatus.FAILED, error: message },
      });
      throw err;
    }
  }
}
