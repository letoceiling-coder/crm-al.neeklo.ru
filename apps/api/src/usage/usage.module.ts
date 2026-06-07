import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageV1Controller, AnalyticsController, DashboardController } from './usage.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { TokenCostModule } from '../token-cost/token-cost.module';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';

@Module({
  imports: [ApiKeysModule, TokenCostModule],
  controllers: [UsageV1Controller, AnalyticsController, DashboardController],
  providers: [UsageService, ApiKeyOrJwtGuard],
  exports: [UsageService],
})
export class UsageModule {}
