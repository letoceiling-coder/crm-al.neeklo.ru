import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentType, Prisma } from '@prisma/client';
import { ListTemplatesQueryDto } from './dto/key-agent.dto';

@Injectable()
export class AgentTemplateService {
  constructor(private prisma: PrismaService) {}

  async list(query: ListTemplatesQueryDto) {
    const where: Prisma.AgentTemplateWhereInput = {
      isPublic: true,
    };
    if (query.agentType) where.agentType = query.agentType;
    if (query.marketplace === true) where.isMarketplace = true;

    return this.prisma.agentTemplate.findMany({
      where,
      orderBy: [{ agentType: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        agentType: true,
        isPublic: true,
        isMarketplace: true,
        defaultPrompt: true,
        defaultSettings: true,
        installCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findBySlug(slug: string) {
    const template = await this.prisma.agentTemplate.findFirst({
      where: { slug, isPublic: true },
    });
    if (!template) throw new NotFoundException('Agent template not found');
    return template;
  }

  async findById(id: string) {
    const template = await this.prisma.agentTemplate.findFirst({
      where: { id, isPublic: true },
    });
    if (!template) throw new NotFoundException('Agent template not found');
    return template;
  }

  async incrementInstallCount(templateId: string) {
    await this.prisma.agentTemplate.update({
      where: { id: templateId },
      data: { installCount: { increment: 1 } },
    });
  }
}
