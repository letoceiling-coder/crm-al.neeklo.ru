import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolsPlanLimitsService {
  constructor(private prisma: PrismaService) {}

  private async maxToolInstances(organizationId: string) {
    const lim = await this.prisma.planLimits.findUnique({ where: { organizationId } });
    return lim?.maxToolInstances ?? 20;
  }

  async assertCanCreateInstance(organizationId: string) {
    const max = await this.maxToolInstances(organizationId);
    const count = await this.prisma.toolInstance.count({ where: { organizationId } });
    if (count >= max) {
      throw new BadRequestException(`Лимит инструментов: ${max}`);
    }
  }
}
