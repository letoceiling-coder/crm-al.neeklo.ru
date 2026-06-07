import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { KeyModelProfilesModule } from './key-model-profiles/key-model-profiles.module';
import { ModelsModule } from './models/models.module';
import { AgentsModule } from './agents/agents.module';
import { GatewayModule } from './gateway/gateway.module';
import { UsageModule } from './usage/usage.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { AuditModule } from './audit/audit.module';
import { CurrencyModule } from './currency/currency.module';
import { GlobalAuthGuard } from './common/guards/global-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CurrencyModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ApiKeysModule,
    KeyModelProfilesModule,
    ModelsModule,
    AgentsModule,
    GatewayModule,
    UsageModule,
    OpenRouterModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
