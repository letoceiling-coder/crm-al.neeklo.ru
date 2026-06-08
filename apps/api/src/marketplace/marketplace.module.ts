import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplacePackageService } from './marketplace-package.service';
import { MarketplaceCategoryService } from './marketplace-category.service';
import { MarketplaceInstallService } from './marketplace-install.service';
import { MarketplaceReviewService } from './marketplace-review.service';
import { MarketplaceCloneService } from './marketplace-clone.service';
import {
  MarketplaceAnalyticsService,
  MarketplaceFeaturedService,
} from './marketplace-featured.service';

@Module({
  imports: [ToolsModule],
  controllers: [MarketplaceController],
  providers: [
    MarketplacePackageService,
    MarketplaceCategoryService,
    MarketplaceInstallService,
    MarketplaceReviewService,
    MarketplaceCloneService,
    MarketplaceFeaturedService,
    MarketplaceAnalyticsService,
  ],
  exports: [MarketplacePackageService, MarketplaceInstallService],
})
export class MarketplaceModule {}
