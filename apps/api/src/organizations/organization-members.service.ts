import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationRole, OrganizationInvitationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

@Injectable()
export class OrganizationMembersService {
  constructor(private prisma: PrismaService) {}

  private assertCanManage(role: OrganizationRole) {
    if (role !== OrganizationRole.OWNER && role !== OrganizationRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to manage members');
    }
  }

  async invite(tenant: TenantContext, email: string, role: OrganizationRole) {
    this.assertCanManage(tenant.organizationRole);
    const normalized = email.trim().toLowerCase();

    const existing = await this.prisma.organizationMember.findFirst({
      where: { organizationId: tenant.organizationId, user: { email: normalized } },
    });
    if (existing) throw new ConflictException('User is already a member');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.organizationInvitation.upsert({
      where: {
        organizationId_email: { organizationId: tenant.organizationId, email: normalized },
      },
      create: {
        organizationId: tenant.organizationId,
        email: normalized,
        role,
        token,
        invitedById: tenant.userId,
        expiresAt,
      },
      update: {
        role,
        token,
        status: OrganizationInvitationStatus.PENDING,
        invitedById: tenant.userId,
        expiresAt,
        acceptedAt: null,
      },
    });
  }

  listInvitations(tenant: TenantContext) {
    this.assertCanManage(tenant.organizationRole);
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(tenant: TenantContext, invitationId: string) {
    this.assertCanManage(tenant.organizationRole);
    const inv = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: tenant.organizationId },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    return this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: OrganizationInvitationStatus.REVOKED },
    });
  }

  async acceptInvitation(userId: string, email: string, token: string) {
    const inv = await this.prisma.organizationInvitation.findUnique({ where: { token } });
    if (!inv || inv.status !== OrganizationInvitationStatus.PENDING) {
      throw new NotFoundException('Invalid invitation');
    }
    if (inv.expiresAt < new Date()) {
      await this.prisma.organizationInvitation.update({
        where: { id: inv.id },
        data: { status: OrganizationInvitationStatus.EXPIRED },
      });
      throw new ForbiddenException('Invitation expired');
    }
    if (inv.email !== email.trim().toLowerCase()) {
      throw new ForbiddenException('Invitation email mismatch');
    }

    await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: {
          organizationId: inv.organizationId,
          userId,
          role: inv.role,
        },
      }),
      this.prisma.organizationInvitation.update({
        where: { id: inv.id },
        data: { status: OrganizationInvitationStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    return { organizationId: inv.organizationId };
  }

  async updateMemberRole(tenant: TenantContext, memberId: string, role: OrganizationRole) {
    this.assertCanManage(tenant.organizationRole);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: tenant.organizationId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === OrganizationRole.OWNER && tenant.organizationRole !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only owner can change owner role');
    }
    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(tenant: TenantContext, memberId: string) {
    this.assertCanManage(tenant.organizationRole);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: tenant.organizationId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === OrganizationRole.OWNER) {
      throw new ForbiddenException('Cannot remove organization owner');
    }
    return this.prisma.organizationMember.delete({ where: { id: memberId } });
  }
}
