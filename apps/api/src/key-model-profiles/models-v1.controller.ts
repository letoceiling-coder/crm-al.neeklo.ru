import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { KeyModelProfilesService } from './key-model-profiles.service';
import { Request } from 'express';

type AuthRequest = Request & {
  user: { id: string; role: string };
  apiKey?: { id: string };
};

@Controller('v1/models')
@Public()
@UseGuards(ApiKeyOrJwtGuard)
export class ModelsV1Controller {
  constructor(
    private apiKeysService: ApiKeysService,
    private profilesService: KeyModelProfilesService,
  ) {}

  @Get()
  async list(@Req() req: AuthRequest) {
    if (!req.apiKey?.id) {
      return {
        error: 'Use API key (Bearer agw_...) to list available models',
        defaultModel: 'auto',
      };
    }
    const apiKey = await this.apiKeysService.getKeyForRouting(req.apiKey.id);
    return this.profilesService.listAvailableModels(apiKey);
  }
}
