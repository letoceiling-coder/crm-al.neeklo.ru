import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { Public } from '../common/decorators';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';
import { Request } from 'express';

type AuthRequest = Request & {
  user: { id: string; role: string };
  apiKey?: { id: string };
};

@Controller('v1/balance')
@Public()
@UseGuards(ApiKeyOrJwtGuard)
export class BalanceV1Controller {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  balance(@Req() req: AuthRequest) {
    if (!req.apiKey?.id) {
      return { error: 'Use API key (Bearer agw_...) to access balance' };
    }
    return this.apiKeysService.getBalanceForApiKey(req.apiKey.id);
  }
}
