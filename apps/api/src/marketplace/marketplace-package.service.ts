import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketplacePackageStatus,
  MarketplacePackageType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { slugify } from '../common/utils/slug.util';
import {
  CreateMarketplacePackageDto,
  ListMarketplacePackagesQueryDto,
  PublishMarketplaceVersionDto,
  UpdateMarketplacePackageDto,
} from './dto/marketplace.dto';
import { MarketplaceManifest, SEMVER_PATTERN } from './marketplace.types';
import { canViewPackage, marketplaceBrowseWhere } from './marketplace-visibility.util';

const packageInclude = {
  category: { select: { id: true, slug: true, name: true } },
  author: { select: { id: true, name: true, email: true } },
  organization: { select: { id: true, name: true, slug: true } },
  versions: { orderBy: { publishedAt: 'desc' as const }, take: 10 },
  assets: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { reviews: true, installsLog: true, versions: true } },
} satisfies Prisma.MarketplacePackageInclude;

@Injectable()
export class MarketplacePackageService {
  constructor(private prisma: PrismaService) {}

  list(tenant: TenantContext, query: ListMarketplacePackagesQueryDto) {
    const where: Prisma.MarketplacePackageWhereInput = query.mine === 'true'
      ? { organizationId: tenant.organizationId }
      : marketplaceBrowseWhere(tenant.organizationId);

    if (query.type) where.type = query.type;
    if (query.visibility) where.visibility = query.visibility;
    if (query.categorySlug) where.category = { slug: query.categorySlug };

    const search = query.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.marketplacePackage.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { installs: 'desc' }, { updatedAt: 'desc' }],
      include: packageInclude,
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const pkg = await this.prisma.marketplacePackage.findUnique({
      where: { id },
      include: {
        ...packageInclude,
        versions: { orderBy: { publishedAt: 'desc' } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            organization: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    if (!canViewPackage(pkg, tenant.organizationId)) {
      throw new ForbiddenException('Package not accessible');
    }

    await this.prisma.marketplacePackage.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });

    return { ...pkg, downloads: pkg.downloads + 1 };
  }

  async create(tenant: TenantContext, dto: CreateMarketplacePackageDto) {
    this.validateManifest(dto.type, dto.manifest);
    const version = dto.version ?? '1.0.0';
    if (!SEMVER_PATTERN.test(version)) {
      throw new BadRequestException('Invalid semver version');
    }

    const baseSlug = dto.slug ?? slugify(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const pkg = await this.prisma.marketplacePackage.create({
      data: {
        organizationId: tenant.organizationId,
        authorId: tenant.userId,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        type: dto.type,
        version,
        visibility: dto.visibility ?? 'PUBLIC',
        icon: dto.icon,
        banner: dto.banner,
        price: dto.price,
        currency: dto.currency ?? 'RUB',
        billingType: dto.billingType ?? 'FREE',
        status: MarketplacePackageStatus.DRAFT,
      },
      include: packageInclude,
    });

    await this.prisma.marketplaceVersion.create({
      data: {
        packageId: pkg.id,
        version,
        changelog: dto.changelog,
        manifest: dto.manifest as Prisma.InputJsonValue,
      },
    });

    return pkg;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateMarketplacePackageDto) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.marketplacePackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.banner !== undefined ? { banner: dto.banner } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.billingType !== undefined ? { billingType: dto.billingType } : {}),
      },
      include: packageInclude,
    });
  }

  async publishVersion(tenant: TenantContext, id: string, dto: PublishMarketplaceVersionDto) {
    const pkg = await this.assertOwned(id, tenant.organizationId);
    this.validateManifest(pkg.type, dto.manifest);

    const existing = await this.prisma.marketplaceVersion.findUnique({
      where: { packageId_version: { packageId: id, version: dto.version } },
    });

    let versionRow;
    if (existing) {
      if (existing.publishedAt) {
        throw new BadRequestException(`Version ${dto.version} already published`);
      }
      versionRow = await this.prisma.marketplaceVersion.update({
        where: { id: existing.id },
        data: {
          changelog: dto.changelog,
          manifest: dto.manifest as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });
    } else {
      versionRow = await this.prisma.marketplaceVersion.create({
        data: {
          packageId: id,
          version: dto.version,
          changelog: dto.changelog,
          manifest: dto.manifest as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });
    }

    const updated = await this.prisma.marketplacePackage.update({
      where: { id },
      data: {
        version: dto.version,
        status: MarketplacePackageStatus.PUBLISHED,
      },
      include: { ...packageInclude, versions: { orderBy: { publishedAt: 'desc' } } },
    });

    return { package: updated, version: versionRow };
  }

  async unpublish(tenant: TenantContext, id: string) {
    await this.assertOwned(id, tenant.organizationId);
    return this.prisma.marketplacePackage.update({
      where: { id },
      data: { status: MarketplacePackageStatus.ARCHIVED },
      include: packageInclude,
    });
  }

  private validateManifest(type: MarketplacePackageType, manifest: Record<string, unknown>) {
    const m = manifest as unknown as MarketplaceManifest;
    if (m.type && m.type !== type) {
      throw new BadRequestException('Manifest type must match package type');
    }
    switch (type) {
      case MarketplacePackageType.ASSISTANT:
        if (!m.assistant?.systemPrompt) {
          throw new BadRequestException('Assistant manifest requires systemPrompt');
        }
        break;
      case MarketplacePackageType.WORKFLOW:
        if (!m.workflow?.triggerType || !m.workflow?.steps?.length) {
          throw new BadRequestException('Workflow manifest requires triggerType and steps');
        }
        break;
      case MarketplacePackageType.TOOL:
        if (!m.tools?.length) {
          throw new BadRequestException('Tool manifest requires at least one tool');
        }
        break;
      case MarketplacePackageType.KNOWLEDGE_TEMPLATE:
        if (!m.knowledgeTemplate?.name) {
          throw new BadRequestException('Knowledge template manifest requires name');
        }
        break;
      case MarketplacePackageType.AUTOMATION_PACKAGE:
        if (!m.assistant && !m.workflow && !m.tools?.length) {
          throw new BadRequestException('Automation package requires at least one component');
        }
        break;
      default:
        break;
    }
  }

  private async ensureUniqueSlug(base: string) {
    let slug = base;
    let i = 0;
    while (await this.prisma.marketplacePackage.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async assertOwned(id: string, organizationId: string) {
    const row = await this.prisma.marketplacePackage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Package not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Package belongs to another organization');
    }
    return row;
  }
}
