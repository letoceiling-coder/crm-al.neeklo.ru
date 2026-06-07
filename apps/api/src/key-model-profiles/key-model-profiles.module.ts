import { Module } from '@nestjs/common';
import { KeyModelProfilesService } from './key-model-profiles.service';
import { KeyModelProfilesController } from './key-model-profiles.controller';
import { ModelsV1Controller } from './models-v1.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';

@Module({
  imports: [ApiKeysModule],
  controllers: [KeyModelProfilesController, ModelsV1Controller],
  providers: [KeyModelProfilesService, ApiKeyOrJwtGuard],
  exports: [KeyModelProfilesService],
})
export class KeyModelProfilesModule {}
