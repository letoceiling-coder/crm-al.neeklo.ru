import { Module } from '@nestjs/common';
import { SupportController, BackupController, LegalController } from './support.controller';
import { SupportDashboardService, BackupCenterService } from './support.service';
import { SystemModule } from '../system/system.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [SystemModule, StorageModule],
  controllers: [SupportController, BackupController, LegalController],
  providers: [SupportDashboardService, BackupCenterService],
})
export class SupportModule {}
