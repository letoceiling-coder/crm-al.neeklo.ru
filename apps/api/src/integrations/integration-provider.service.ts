import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationProviderService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.integrationProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findByType(provider: string) {
    return this.prisma.integrationProvider.findUnique({
      where: { provider: provider as never },
    });
  }
}
