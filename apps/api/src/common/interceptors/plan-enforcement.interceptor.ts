import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { IS_PUBLIC_KEY } from '../decorators';
import { SKIP_PLAN_ENFORCEMENT_KEY } from '../decorators/plan-enforcement.decorator';
import { SystemRateLimitService } from '../../system/system-rate-limit.service';
import { TenantContext } from '../interfaces/tenant-context.interface';

const ENFORCED_PREFIXES = [
  '/api/v1/assistants',
  '/api/v1/knowledge',
  '/api/v1/memory',
  '/api/v1/crm',
  '/api/v1/workflows',
  '/api/v1/marketplace',
  '/api/v1/integrations',
  '/api/v1/chat',
  '/api/v1/agents',
  '/api/v1/tools',
  '/api/v1/billing',
  '/api/v1/organizations',
];

@Injectable()
export class PlanEnforcementInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private rateLimits: SystemRateLimitService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PLAN_ENFORCEMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || skip) return next.handle();

    const request = context.switchToHttp().getRequest();
    const path: string = request.url?.split('?')[0] ?? request.path ?? '';
    if (!ENFORCED_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const tenant = request.tenantContext as TenantContext | undefined;
    if (!tenant?.organizationId) return next.handle();

    const apiKeyId = request.apiKey?.id as string | undefined;

    return from(this.enforce(tenant.organizationId, apiKeyId)).pipe(switchMap(() => next.handle()));
  }

  private async enforce(organizationId: string, apiKeyId?: string) {
    await this.rateLimits.assertOrganizationLimits(organizationId);
    if (apiKeyId) await this.rateLimits.assertApiKeyLimits(apiKeyId);
  }
}
