import { Module } from '@nestjs/common';
import { AlertingService } from './alerting.service';
import { TelegramPlatformModule } from '../telegram-platform/telegram-platform.module';

@Module({
  imports: [TelegramPlatformModule],
  providers: [AlertingService],
  exports: [AlertingService],
})
export class AlertingModule {}