import { Module } from '@nestjs/common';
import { TokenCostService } from './token-cost.service';
import { TokenCostAdminController } from './token-cost.controller';

@Module({
  controllers: [TokenCostAdminController],
  providers: [TokenCostService],
  exports: [TokenCostService],
})
export class TokenCostModule {}
