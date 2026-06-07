import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { apiHttpException } from '../api-error.util';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyOrJwtGuard extends AuthGuard('jwt') {
  constructor(private apiKeysService: ApiKeysService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization as string | undefined;

    if (!auth?.startsWith('Bearer ')) {
      if (this.isPublicApiKeyRoute(request)) {
        apiHttpException(
          HttpStatus.UNAUTHORIZED,
          'MISSING_API_KEY',
          'Укажите API-ключ в заголовке: Authorization: Bearer agw_...',
          'Unauthorized',
        );
      }
      throw new UnauthorizedException('Требуется авторизация');
    }

    const token = auth.slice(7);

    if (token.startsWith('agw_')) {
      const apiKey = await this.apiKeysService.validateKey(token);
      if (!apiKey) {
        apiHttpException(
          HttpStatus.UNAUTHORIZED,
          'INVALID_API_KEY',
          'API-ключ недействителен, отключён или заблокирован.',
          'Unauthorized',
        );
      }

      request.user = {
        id: apiKey.userId,
        email: apiKey.user.email,
        role: apiKey.user.role,
      };
      request.apiKey = apiKey;
      return true;
    }

    const result = await super.canActivate(context);
    return result as boolean;
  }

  private isPublicApiKeyRoute(request: { path?: string; url?: string }) {
    const path = request.path ?? request.url ?? '';
    return path.includes('/v1/');
  }
}
