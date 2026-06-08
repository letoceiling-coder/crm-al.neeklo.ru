import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { TenantModule } from './tenant/tenant.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SecretsModule } from './secrets/secrets.module';
import { ProviderAccountsModule } from './provider-accounts/provider-accounts.module';
import { TokenCostModule } from './token-cost/token-cost.module';
import { QueueModule } from './queue/queue.module';
import { ParserClientModule } from './parser-client/parser-client.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { AssistantsModule } from './assistants/assistants.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ToolsModule } from './tools/tools.module';
import { CrmModule } from './crm/crm.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { MemoryModule } from './memory/memory.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CacheModule } from './cache/cache.module';
import { SystemModule } from './system/system.module';
import { BillingModule } from './billing/billing.module';
import { ExportsModule } from './exports/exports.module';
import { SupportModule } from './support/support.module';
import { TenantGuard } from './tenant/tenant.guard';
import { TenantInterceptor } from './tenant/tenant.interceptor';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';
import { PlanEnforcementInterceptor } from './common/interceptors/plan-enforcement.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CurrencyModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    TenantModule,
    OrganizationsModule,
    SecretsModule,
    ProviderAccountsModule,
    TokenCostModule,
    QueueModule,
    ParserClientModule,
    StorageModule,
    EmbeddingModule,
    HealthModule,
    AssistantsModule,
    KnowledgeModule,
    ToolsModule,
    CrmModule,
    WorkflowsModule,
    MemoryModule,
    IntegrationsModule,
    MarketplaceModule,
    CacheModule,
    SystemModule,
    BillingModule,
    ExportsModule,
    SupportModule,
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
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PlanEnforcementInterceptor,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
    { provide: APP_INTERCEPTOR, useClass: PlanEnforcementInterceptor },
  ],
})
export class AppModule {}
