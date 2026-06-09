import { Module } from '@nestjs/common';
import { SecretsModule } from '../secrets/secrets.module';
import { TelegramPlatformService } from './telegram-platform.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramAdminController } from './telegram-admin.controller';

@Module({
  imports: [SecretsModule],
  controllers: [TelegramWebhookController, TelegramAdminController],
  providers: [TelegramPlatformService],
  exports: [TelegramPlatformService],
})
export class TelegramPlatformModule {}
