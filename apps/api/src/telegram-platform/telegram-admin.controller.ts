import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  TelegramNotificationStatus,
  TelegramNotificationType,
  TelegramUserStatus,
} from '@prisma/client';
import { Request } from 'express';
import { AdminGuard } from '../common/guards/admin.guard';
import { TelegramPlatformService } from './telegram-platform.service';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('Telegram Admin')
@ApiBearerAuth()
@Controller('v1/system/telegram')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class TelegramAdminController {
  constructor(private telegram: TelegramPlatformService) {}

  @Get('settings')
  getSettings() {
    return this.telegram.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() body: { botToken?: string }, @Req() req: AuthRequest) {
    return this.telegram.updateSettings(body, req.user.id);
  }

  @Post('settings/test')
  @ApiOperation({ summary: 'Проверить подключение бота' })
  testConnection() {
    return this.telegram.testConnection();
  }

  @Post('settings/register-webhook')
  @ApiOperation({ summary: 'Зарегистрировать webhook' })
  registerWebhook(@Req() req: AuthRequest) {
    return this.telegram.registerWebhook(req.user.id);
  }

  @Get('users')
  listUsers(@Query('status') status?: TelegramUserStatus) {
    return this.telegram.listUsers(status);
  }

  @Post('users/:id/approve')
  approve(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.telegram.approveUser(id, req.user.id);
  }

  @Post('users/:id/reject')
  reject(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.telegram.rejectUser(id, req.user.id);
  }

  @Get('notifications')
  listNotifications(
    @Query('type') type?: TelegramNotificationType,
    @Query('userId') userId?: string,
    @Query('status') status?: TelegramNotificationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.telegram.listNotifications({
      type,
      userId,
      status,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
