import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  BillingPlanTier,
  OrganizationRole,
  OrganizationType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingPlanService } from '../billing/billing.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { slugify } from '../common/utils/slug.util';
import { RegisterDto } from './dto/auth.dto';

@Injectable()
export class SignupService {
  constructor(
    private prisma: PrismaService,
    private plans: BillingPlanService,
    private settings: SystemSettingsService,
  ) {}

  async assertRegistrationEnabled() {
    if (!(await this.settings.isRegistrationEnabled())) {
      throw new ForbiddenException('Public registration is not enabled');
    }
  }

  async register(dto: RegisterDto) {
    await this.assertRegistrationEnabled();

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(dto.password, 12);
    const baseSlug = slugify(dto.organizationName || email.split('@')[0]);
    let slug = baseSlug;
    let suffix = 0;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const freePlan = await this.plans.findByTier(BillingPlanTier.FREE);
    if (!freePlan) throw new ConflictException('FREE plan not configured');

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hash,
          name: dto.name ?? dto.organizationName,
          onboardingCompleted: false,
          onboardingStep: 0,
        },
      });

      const org = await tx.organization.create({
        data: {
          type: OrganizationType.COMPANY,
          name: dto.organizationName,
          slug,
          members: {
            create: { userId: user.id, role: OrganizationRole.OWNER },
          },
          planLimits: { create: {} },
          subscription: {
            create: {
              planId: freePlan.id,
              status: SubscriptionStatus.ACTIVE,
              startDate: now,
              renewalDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { activeOrganizationId: org.id },
      });

      return { user, org };
    });

    await this.plans.syncPlanLimitsToOrganization(result.org.id, freePlan.id);
    return result;
  }
}
