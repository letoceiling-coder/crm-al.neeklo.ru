import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { OrganizationRole, OrganizationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async ensurePersonalOrganization(userId: string, email: string, name?: string | null) {
    const existing = await this.prisma.organizationMember.findFirst({
      where: { userId, role: OrganizationRole.OWNER },
      include: { organization: true },
    });
    if (existing) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && !user.activeOrganizationId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { activeOrganizationId: existing.organizationId },
        });
      }
      return existing.organization;
    }

    const baseSlug = slugify(email.split('@')[0] || 'user');
    let slug = baseSlug;
    let suffix = 0;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          type: OrganizationType.PERSONAL,
          name: name || email,
          slug,
          members: {
            create: {
              userId,
              role: OrganizationRole.OWNER,
            },
          },
          planLimits: {
            create: {},
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { activeOrganizationId: org.id },
      });

      return org;
    });
  }

  async getCurrentOrganization(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: {
        organization: { include: { planLimits: true } },
      },
    });
    if (!member || !member.organization.isActive) {
      throw new ForbiddenException('Organization access denied');
    }
    return {
      ...member.organization,
      memberRole: member.role,
    };
  }

  async switchOrganization(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });
    if (!member || !member.organization.isActive) {
      throw new ForbiddenException('Cannot switch to this organization');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: organizationId },
    });
    return {
      organizationId,
      organizationRole: member.role,
      organization: member.organization,
    };
  }

  async listMembers(userId: string, organizationId: string) {
    await this.assertMembership(userId, organizationId);
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveOrganizationContext(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        activeOrganization: true,
        organizationMembers: { include: { organization: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    let organizationId = user.activeOrganizationId;
    if (!organizationId) {
      const org = await this.ensurePersonalOrganization(user.id, user.email, user.name);
      organizationId = org.id;
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of active organization');
    }

    return {
      organizationId,
      organizationRole: member.role,
    };
  }

  async assertMembership(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member) throw new ForbiddenException('Organization access denied');
    return member;
  }

  async assertOrganizationResource(organizationId: string, resourceOrganizationId: string) {
    if (organizationId !== resourceOrganizationId) {
      throw new ForbiddenException('Tenant isolation violation');
    }
  }

  async updateOrganization(tenant: { userId: string; organizationId: string; organizationRole: OrganizationRole }, dto: { name?: string }) {
    if (
      tenant.organizationRole !== OrganizationRole.OWNER &&
      tenant.organizationRole !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException('Insufficient organization permissions');
    }
    return this.prisma.organization.update({
      where: { id: tenant.organizationId },
      data: { name: dto.name },
      include: { planLimits: true },
    });
  }
}
