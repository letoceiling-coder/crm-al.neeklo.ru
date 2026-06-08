import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const traceId = (request.headers['x-trace-id'] as string) || randomUUID();
    request.traceId = traceId;
    request.headers['x-trace-id'] = traceId;
    return next.handle();
  }
}
