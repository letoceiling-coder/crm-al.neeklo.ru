import { Global, Module } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [TenantGuard, TenantInterceptor],
  exports: [TenantGuard, TenantInterceptor],
})
export class TenantModule {}
