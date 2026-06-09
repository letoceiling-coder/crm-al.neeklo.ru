import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { TelegramPlatformService } from './telegram-platform.service';

@ApiTags('Telegram')
@Controller('v1/telegram')
export class TelegramWebhookController {
  constructor(private telegram: TelegramPlatformService) {}

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Telegram Bot API webhook' })
  handleWebhook(@Body() body: Record<string, unknown>) {
    return this.telegram.handleWebhookUpdate(body);
  }
}
