import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { GatewayController } from './gateway.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { UsageModule } from '../usage/usage.module';
import { AgentsModule } from '../agents/agents.module';

import { KeyModelProfilesModule } from '../key-model-profiles/key-model-profiles.module';

@Module({
  imports: [ApiKeysModule, KeyModelProfilesModule, OpenRouterModule, UsageModule, AgentsModule],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
