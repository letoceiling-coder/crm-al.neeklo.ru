import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { LoginDto, Enable2FaDto, UpdateThemeDto, ChangePasswordDto } from './dto/auth.dto';
import { AuditAction } from '@prisma/client';
import { JwtPayload } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private organizations: OrganizationsService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      await this.audit.log(AuditAction.LOGIN_FAILED, null, { email: dto.email }, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit.log(AuditAction.LOGIN_FAILED, user.id, { email: dto.email }, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.twoFaEnabled) {
      if (!dto.twoFaCode) {
        return { requires2Fa: true };
      }
      const valid2Fa = authenticator.verify({
        token: dto.twoFaCode,
        secret: user.twoFaSecret!,
      });
      if (!valid2Fa) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    await this.audit.log(AuditAction.LOGIN, user.id, {}, ip, userAgent);

    await this.organizations.ensurePersonalOrganization(user.id, user.email, user.name);
    const token = await this.signToken(user);
    return {
      accessToken: token,
      user: await this.sanitizeUser(user.id),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitizeUser(userId);
  }

  async setup2Fa(userId: string) {
    const secret = authenticator.generateSecret();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const otpauth = authenticator.keyuri(user.email, 'AI Gateway', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaSecret: secret },
    });

    return { secret, qrCode };
  }

  async enable2Fa(userId: string, dto: Enable2FaDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFaSecret) throw new BadRequestException('Setup 2FA first');

    const valid = authenticator.verify({ token: dto.code, secret: user.twoFaSecret });
    if (!valid) throw new BadRequestException('Invalid code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: true },
    });
    await this.audit.log(AuditAction.TWO_FA_ENABLED, userId, {}, ip);
    return { enabled: true };
  }

  async disable2Fa(userId: string, dto: Enable2FaDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFaSecret) throw new BadRequestException('2FA not enabled');

    const valid = authenticator.verify({ token: dto.code, secret: user.twoFaSecret });
    if (!valid) throw new BadRequestException('Invalid code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: false, twoFaSecret: null },
    });
    await this.audit.log(AuditAction.TWO_FA_DISABLED, userId, {}, ip);
    return { enabled: false };
  }

  async updateTheme(userId: string, dto: UpdateThemeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { theme: dto.theme },
    });
    return this.sanitizeUser(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { success: true };
  }

  async issueAccessToken(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.signToken(user);
  }

  private async signToken(user: { id: string; email: string; role: string }) {
    const { organizationId, organizationRole } =
      await this.organizations.resolveOrganizationContext(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      organizationId,
      organizationRole,
    };

    return this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '7d'),
    });
  }

  private async sanitizeUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        activeOrganization: {
          select: { id: true, name: true, slug: true, type: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      theme: user.theme,
      twoFaEnabled: user.twoFaEnabled,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      createdAt: user.createdAt,
      activeOrganizationId: user.activeOrganizationId,
      activeOrganization: user.activeOrganization,
    };
  }
}
