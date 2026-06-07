import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { Public } from '../common/decorators';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';
import { TopUpQueryDto } from './dto/api-keys.dto';
import { Request } from 'express';

type AuthRequest = Request & {
  user: { id: string; role: string };
  apiKey?: { id: string };
};

@Controller('v1/balance/top-ups')
@Public()
@UseGuards(ApiKeyOrJwtGuard)
export class BalanceTopUpsV1Controller {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get('stats')
  stats(@Req() req: AuthRequest, @Query() query: TopUpQueryDto) {
    if (!req.apiKey?.id) {
      return { error: 'Use API key (Bearer agw_...) to get top-up stats' };
    }
    return this.apiKeysService.getTopUpStats(req.user.id, req.user.role as never, {
      ...query,
      apiKeyId: req.apiKey.id,
    });
  }

  @Get()
  list(@Req() req: AuthRequest, @Query() query: TopUpQueryDto) {
    if (!req.apiKey?.id) {
      return { error: 'Use API key (Bearer agw_...) to list top-ups' };
    }
    return this.apiKeysService.listTopUps(req.user.id, req.user.role as never, {
      ...query,
      apiKeyId: req.apiKey.id,
    });
  }
}
