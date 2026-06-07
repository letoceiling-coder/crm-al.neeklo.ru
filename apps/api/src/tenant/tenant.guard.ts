import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { OrganizationRole } from '@prisma/client';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    if (request.apiKey?.organizationId) {
      request.tenantContext = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: request.apiKey.organizationId,
        organizationRole: (user.organizationRole as OrganizationRole) ?? OrganizationRole.OPERATOR,
      } satisfies TenantContext;
      return true;
    }

    let organizationId = user.organizationId as string | undefined;
    let organizationRole = user.organizationRole as OrganizationRole | undefined;

    if (!organizationId || !organizationRole) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { activeOrganizationId: true },
      });
      organizationId = dbUser?.activeOrganizationId ?? undefined;
      if (organizationId) {
        const member = await this.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: { organizationId, userId: user.id },
          },
        });
        organizationRole = member?.role;
      }
    }

    if (!organizationId || !organizationRole) {
      throw new ForbiddenException('Active organization context is required');
    }

    request.tenantContext = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId,
      organizationRole,
    } satisfies TenantContext;

    if (request.body?.organizationId && request.body.organizationId !== organizationId) {
      throw new ForbiddenException('organizationId cannot be overridden via request body');
    }

    return true;
  }
}
