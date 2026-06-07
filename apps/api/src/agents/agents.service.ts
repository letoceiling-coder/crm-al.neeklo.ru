import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agents.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { skipTake, paginate } from '../common/utils/pagination.util';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: PaginationQueryDto, publicOnly = false) {
    const where = publicOnly ? { isPublic: true, isActive: true } : {};
    const { skip, take } = skipTake(query);
    const [items, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          modelChain: {
            orderBy: { priority: 'asc' },
            include: { model: { select: { id: true, name: true, openrouterId: true } } },
          },
          tools: true,
        },
      }),
      this.prisma.agent.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        modelChain: {
          orderBy: { priority: 'asc' },
          include: { model: true },
        },
        tools: true,
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(dto: CreateAgentDto, adminId: string) {
    const agent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agent.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          avatar: dto.avatar,
          systemPrompt: dto.systemPrompt,
          temperature: dto.temperature ?? 0.7,
          maxContext: dto.maxContext ?? 128000,
          isPublic: dto.isPublic ?? true,
        },
      });

      await tx.agentModelChain.createMany({
        data: dto.modelChain.map((m) => ({
          agentId: created.id,
          modelId: m.modelId,
          priority: m.priority,
        })),
      });

      if (dto.tools?.length) {
        await tx.agentTool.createMany({
          data: dto.tools.map((t) => ({
            agentId: created.id,
            name: t.name,
            description: t.description,
          })),
        });
      }

      return created;
    });

    await this.audit.log(AuditAction.AGENT_CREATED, adminId, { agentId: agent.id });
    return this.findOne(agent.id);
  }

  async update(id: string, dto: UpdateAgentDto, adminId: string) {
    await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          avatar: dto.avatar,
          systemPrompt: dto.systemPrompt,
          temperature: dto.temperature,
          maxContext: dto.maxContext,
          isPublic: dto.isPublic,
          isActive: dto.isActive,
        },
      });

      if (dto.modelChain) {
        await tx.agentModelChain.deleteMany({ where: { agentId: id } });
        await tx.agentModelChain.createMany({
          data: dto.modelChain.map((m) => ({
            agentId: id,
            modelId: m.modelId,
            priority: m.priority,
          })),
        });
      }

      if (dto.tools) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        await tx.agentTool.createMany({
          data: dto.tools.map((t) => ({
            agentId: id,
            name: t.name,
            description: t.description,
          })),
        });
      }
    });

    await this.audit.log(AuditAction.AGENT_UPDATED, adminId, { agentId: id });
    return this.findOne(id);
  }

  async remove(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.agent.delete({ where: { id } });
    await this.audit.log(AuditAction.AGENT_DELETED, adminId, { agentId: id });
    return { deleted: true };
  }
}
