import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController, AgentsAdminController } from './agents.controller';
import { AgentsV1Controller } from './agents-v1.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuditModule } from '../audit/audit.module';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';

@Module({
  imports: [AuditModule, ApiKeysModule],
  controllers: [AgentsController, AgentsAdminController, AgentsV1Controller],
  providers: [AgentsService, ApiKeyOrJwtGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
