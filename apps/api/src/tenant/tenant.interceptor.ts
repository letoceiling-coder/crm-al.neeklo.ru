import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenant = request.tenantContext as TenantContext | undefined;
    if (tenant) {
      request.headers['x-organization-id'] = tenant.organizationId;
    }
    return next.handle();
  }
}
