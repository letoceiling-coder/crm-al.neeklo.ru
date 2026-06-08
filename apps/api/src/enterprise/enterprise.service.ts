import { Injectable, NotFoundException } from '@nestjs/common';
import { EnterpriseContractStatus, BillingPlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingPlanService, SubscriptionService } from '../billing/billing.service';
import { CreateEnterpriseContractDto, UpdateEnterpriseContractDto } from './dto/enterprise.dto';
import { serializeBigInts } from '../common/utils/serialize.util';

@Injectable()
export class EnterpriseService {
  constructor(
    private prisma: PrismaService,
    private plans: BillingPlanService,
    private subscriptions: SubscriptionService,
  ) {}

  async create(dto: CreateEnterpriseContractDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: dto.organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const contract = await this.prisma.enterpriseContract.create({
      data: {
        organizationId: dto.organizationId,
        contractNumber: dto.contractNumber,
        slaLevel: dto.slaLevel,
        dpaSignedAt: dto.dpaSignedAt ? new Date(dto.dpaSignedAt) : undefined,
        dpaDocumentUrl: dto.dpaDocumentUrl,
        customPriceMonthlyRub: dto.customPriceMonthlyRub,
        customLimits: dto.customLimits ?? {},
        status: EnterpriseContractStatus.DRAFT,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
      },
    });

    return serializeBigInts(contract);
  }

  async activate(contractId: string) {
    const contract = await this.prisma.enterpriseContract.findUnique({
      where: { id: contractId },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    await this.prisma.enterpriseContract.update({
      where: { id: contractId },
      data: { status: EnterpriseContractStatus.ACTIVE },
    });

    await this.subscriptions.applyPaidPlan(contract.organizationId, BillingPlanTier.ENTERPRISE);

    if (contract.customLimits && typeof contract.customLimits === 'object') {
      const limits = contract.customLimits as Record<string, number>;
      await this.prisma.planLimits.update({
        where: { organizationId: contract.organizationId },
        data: limits,
      });
    }

    return { activated: true, contractId };
  }

  list() {
    return this.prisma.enterpriseContract.findMany({
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    }).then(serializeBigInts);
  }

  getByOrganization(organizationId: string) {
    return this.prisma.enterpriseContract.findUnique({
      where: { organizationId },
    }).then((c) => (c ? serializeBigInts(c) : null));
  }
}
