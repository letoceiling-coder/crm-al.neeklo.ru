import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SystemModule } from '../system/system.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { SystemSettingsCache } from './system-settings-cache.service';
import { SystemSettingsService } from './system-settings.service';
import { SystemIntegrationsService } from './system-integrations.service';
import {
  SystemLaunchController,
  SystemSettingsController,
  SystemSettingsPublicController,
} from './system-settings.controller';

@Global()
@Module({
  imports: [AuditModule, SecretsModule, SystemModule],
  controllers: [SystemSettingsController, SystemLaunchController, SystemSettingsPublicController],
  providers: [
    SystemSettingsCache,
    SystemSettingsService,
    SystemIntegrationsService,
    AdminGuard,
  ],
  exports: [SystemSettingsService, SystemIntegrationsService, SystemSettingsCache],
})
export class SystemSettingsModule {}
