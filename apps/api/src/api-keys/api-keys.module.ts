import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController, ApiKeysAdminController } from './api-keys.controller';
import { BalanceV1Controller } from './balance-v1.controller';
import { BalanceTopUpsV1Controller } from './balance-topups-v1.controller';
import { AuditModule } from '../audit/audit.module';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';

@Module({
  imports: [AuditModule],
  controllers: [
    ApiKeysController,
    ApiKeysAdminController,
    BalanceV1Controller,
    BalanceTopUpsV1Controller,
  ],
  providers: [ApiKeysService, ApiKeyOrJwtGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
