import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { JwtPayload } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    let organizationId = payload.organizationId ?? user.activeOrganizationId ?? undefined;
    let organizationRole: OrganizationRole | undefined = payload.organizationRole;

    if (organizationId && !organizationRole) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: user.id },
        },
      });
      organizationRole = member?.role ?? OrganizationRole.OPERATOR;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      theme: user.theme,
      organizationId,
      organizationRole,
    };
  }
}
