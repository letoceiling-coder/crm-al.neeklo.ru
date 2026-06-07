import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from './openrouter.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditAction, UserRole } from '@prisma/client';

@Controller('admin/openrouter')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class OpenRouterController {
  constructor(
    private prisma: PrismaService,
    private openRouter: OpenRouterService,
    private audit: AuditService,
  ) {}

  @Get('keys')
  async listKeys() {
    return this.prisma.openRouterKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        balance: true,
        isActive: true,
        isDefault: true,
        lastCheckedAt: true,
        createdAt: true,
      },
    });
  }

  @Post('keys')
  async addKey(@Body() body: { name: string; key: string; isDefault?: boolean }) {
    const prefix = body.key.slice(0, 8);
    if (body.isDefault) {
      await this.prisma.openRouterKey.updateMany({ data: { isDefault: false } });
    }
    const created = await this.prisma.openRouterKey.create({
      data: {
        name: body.name,
        keyHash: body.key,
        keyPrefix: prefix,
        isDefault: body.isDefault ?? false,
      },
    });
    await this.audit.log(AuditAction.OPENROUTER_KEY_ADDED, null, { keyId: created.id });
    return { id: created.id, name: created.name, keyPrefix: prefix };
  }

  @Delete('keys/:id')
  async removeKey(@Param('id') id: string) {
    await this.prisma.openRouterKey.delete({ where: { id } });
    await this.audit.log(AuditAction.OPENROUTER_KEY_REMOVED, null, { keyId: id });
    return { deleted: true };
  }

  @Post('keys/:id/check-balance')
  async checkBalance(@Param('id') id: string) {
    const keyRecord = await this.prisma.openRouterKey.findUnique({ where: { id } });
    if (!keyRecord) return { error: 'Key not found' };

    const balance = await this.openRouter.checkBalance(keyRecord.keyHash);
    if (balance?.data?.limit_remaining != null) {
      await this.prisma.openRouterKey.update({
        where: { id },
        data: {
          balance: balance.data.limit_remaining,
          lastCheckedAt: new Date(),
        },
      });
    }
    return balance;
  }
}
