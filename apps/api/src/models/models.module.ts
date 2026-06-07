import { Module } from '@nestjs/common';
import { ModelsService } from './models.service';
import { ModelsController, ModelsAdminController } from './models.controller';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { AuditModule } from '../audit/audit.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [OpenRouterModule, AuditModule, UsageModule],
  controllers: [ModelsController, ModelsAdminController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
