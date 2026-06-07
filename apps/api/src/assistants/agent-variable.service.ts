import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KeyAgentService } from './key-agent.service';
import { PromptRenderService } from './prompt-render.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { UpsertAgentVariablesDto } from './dto/agent-variable.dto';
import { STANDARD_AGENT_VARIABLES } from './constants/standard-variables';

@Injectable()
export class AgentVariableService {
  constructor(
    private prisma: PrismaService,
    private keyAgents: KeyAgentService,
    private promptRender: PromptRenderService,
  ) {}

  async list(tenant: TenantContext, keyAgentId: string) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    return this.prisma.agentVariable.findMany({
      where: { keyAgentId },
      orderBy: { key: 'asc' },
    });
  }

  async upsertMany(tenant: TenantContext, keyAgentId: string, dto: UpsertAgentVariablesDto) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);

    for (const item of dto.variables) {
      if (!/^[a-z][a-z0-9_]*$/.test(item.key)) {
        throw new BadRequestException(`Invalid variable key: ${item.key}`);
      }
    }

    await this.prisma.$transaction(
      dto.variables.map((item) =>
        this.prisma.agentVariable.upsert({
          where: { keyAgentId_key: { keyAgentId, key: item.key } },
          create: { keyAgentId, key: item.key, value: item.value },
          update: { value: item.value },
        }),
      ),
    );

    return this.list(tenant, keyAgentId);
  }

  async remove(tenant: TenantContext, keyAgentId: string, key: string) {
    await this.keyAgents.assertOwned(keyAgentId, tenant.organizationId);
    await this.prisma.agentVariable.deleteMany({
      where: { keyAgentId, key },
    });
    return { deleted: true, key };
  }

  async renderPrompt(tenant: TenantContext, keyAgentId: string, promptOverride?: string) {
    const agent = await this.keyAgents.findOne(tenant, keyAgentId);
    if (!agent) throw new BadRequestException('Assistant not found');

    const variables = Object.fromEntries(agent.variables.map((v) => [v.key, v.value]));
    const template = promptOverride ?? agent.systemPrompt;
    const result = this.promptRender.renderSystemPrompt(template, variables);

    return {
      rendered: result.rendered,
      missing: result.missing,
      placeholders: this.promptRender.extractPlaceholders(template),
      standardVariables: STANDARD_AGENT_VARIABLES,
    };
  }
}
