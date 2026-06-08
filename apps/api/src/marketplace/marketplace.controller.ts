import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { MarketplacePackageService } from './marketplace-package.service';
import { MarketplaceCategoryService } from './marketplace-category.service';
import { MarketplaceInstallService } from './marketplace-install.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import {
  MarketplaceAnalyticsService,
  MarketplaceFeaturedService,
} from './marketplace-featured.service';
import {
  CreateMarketplacePackageDto,
  CreateMarketplaceReviewDto,
  FeaturedMarketplaceQueryDto,
  InstallMarketplacePackageDto,
  ListMarketplacePackagesQueryDto,
  PublishMarketplaceVersionDto,
  UpdateMarketplacePackageDto,
} from './dto/marketplace.dto';

@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('v1/marketplace')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class MarketplaceController {
  constructor(
    private packages: MarketplacePackageService,
    private categories: MarketplaceCategoryService,
    private installs: MarketplaceInstallService,
    private reviews: MarketplaceReviewService,
    private featured: MarketplaceFeaturedService,
    private analytics: MarketplaceAnalyticsService,
  ) {}

  @Get('packages')
  @ApiOperation({ summary: 'List marketplace packages' })
  listPackages(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListMarketplacePackagesQueryDto,
  ) {
    return this.packages.list(tenant, query);
  }

  @Post('packages')
  @ApiOperation({ summary: 'Create marketplace package (draft)' })
  createPackage(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateMarketplacePackageDto) {
    return this.packages.create(tenant, dto);
  }

  @Get('packages/:id')
  @ApiOperation({ summary: 'Get package detail' })
  getPackage(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.packages.findOne(tenant, id);
  }

  @Patch('packages/:id')
  @ApiOperation({ summary: 'Update marketplace package' })
  updatePackage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplacePackageDto,
  ) {
    return this.packages.update(tenant, id, dto);
  }

  @Post('packages/:id/publish')
  @ApiOperation({ summary: 'Publish new package version' })
  publishVersion(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: PublishMarketplaceVersionDto,
  ) {
    return this.packages.publishVersion(tenant, id, dto);
  }

  @Post('packages/:id/unpublish')
  @ApiOperation({ summary: 'Archive / unpublish package' })
  unpublish(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.packages.unpublish(tenant, id);
  }

  @Get('packages/:id/analytics')
  @ApiOperation({ summary: 'Package analytics (author org only)' })
  packageAnalytics(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.analytics.getPackageAnalytics(id, tenant.organizationId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List marketplace categories' })
  listCategories() {
    return this.categories.list();
  }

  @Post('install')
  @ApiOperation({ summary: 'Install package (clone into organization)' })
  install(@CurrentTenant() tenant: TenantContext, @Body() dto: InstallMarketplacePackageDto) {
    return this.installs.install(tenant, dto);
  }

  @Get('installed')
  @ApiOperation({ summary: 'List installed packages for current organization' })
  listInstalled(@CurrentTenant() tenant: TenantContext) {
    return this.installs.listInstalled(tenant);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'List reviews for a package' })
  listReviews(
    @CurrentTenant() tenant: TenantContext,
    @Query('packageId') packageId: string,
  ) {
    return this.reviews.listForPackage(tenant, packageId);
  }

  @Post('reviews')
  @ApiOperation({ summary: 'Create or update review' })
  createReview(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateMarketplaceReviewDto) {
    return this.reviews.create(tenant, dto);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Featured, popular, new, top rated, most installed' })
  getFeatured(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FeaturedMarketplaceQueryDto,
  ) {
    return this.featured.getFeatured(tenant.organizationId, query.limit ?? 12);
  }
}
