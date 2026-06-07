import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { AgentTemplateService } from './agent-template.service';
import { KeyAgentService } from './key-agent.service';
import { AgentApiKeyService } from './agent-api-key.service';
import { AgentVariableService } from './agent-variable.service';
import {
  CreateKeyAgentDto,
  UpdateKeyAgentDto,
  ListAssistantsQueryDto,
  ListTemplatesQueryDto,
} from './dto/key-agent.dto';
import { CreateAgentApiKeyDto, RotateAgentApiKeyDto } from './dto/agent-api-key.dto';
import { UpsertAgentVariablesDto, RenderPromptDto } from './dto/agent-variable.dto';
import {
  UpsertKnowledgeBindingDto,
  UpdateKnowledgeBindingDto,
  AssistantContextPreviewDto,
  AssistantChatDto,
} from './dto/assistant-knowledge-binding.dto';
import { AssistantKnowledgeBindingService } from './assistant-knowledge-binding.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantChatService } from './assistant-chat.service';
import { AssistantToolBindingService } from '../tools/assistant-tool-binding.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import {
  UpsertToolBindingDto,
  UpdateToolBindingDto,
  ExecuteToolDto,
} from '../tools/dto/tool.dto';

@ApiTags('Assistants')
@ApiBearerAuth()
@Controller('v1/assistants')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AssistantsController {
  constructor(
    private templates: AgentTemplateService,
    private keyAgents: KeyAgentService,
    private agentApiKeys: AgentApiKeyService,
    private variables: AgentVariableService,
    private kbBindings: AssistantKnowledgeBindingService,
    private context: AssistantContextService,
    private chat: AssistantChatService,
    private toolBindings: AssistantToolBindingService,
    private toolExecution: ToolExecutionService,
  ) {}

  @Get('templates')
  @ApiOperation({ summary: 'List public agent templates' })
  listTemplates(@Query() query: ListTemplatesQueryDto) {
    return this.templates.list(query);
  }

  @Get('templates/:slug')
  @ApiOperation({ summary: 'Get agent template by slug' })
  getTemplate(@Param('slug') slug: string) {
    return this.templates.findBySlug(slug);
  }

  @Get()
  @ApiOperation({ summary: 'List assistants in current organization' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListAssistantsQueryDto) {
    return this.keyAgents.findAll(tenant, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create assistant' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateKeyAgentDto) {
    return this.keyAgents.create(tenant, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assistant by id' })
  getOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.keyAgents.findOne(tenant, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update assistant' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateKeyAgentDto,
  ) {
    return this.keyAgents.update(tenant, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assistant' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.keyAgents.remove(tenant, id);
  }

  @Get(':id/keys')
  @ApiOperation({ summary: 'List agent API keys (agt_)' })
  listKeys(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.agentApiKeys.list(tenant, id);
  }

  @Post(':id/keys')
  @ApiOperation({ summary: 'Create agent API key' })
  createKey(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CreateAgentApiKeyDto,
  ) {
    return this.agentApiKeys.create(tenant, id, dto);
  }

  @Post(':id/keys/:keyId/rotate')
  @ApiOperation({ summary: 'Rotate agent API key' })
  rotateKey(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Body() dto: RotateAgentApiKeyDto,
  ) {
    return this.agentApiKeys.rotate(tenant, id, keyId, dto);
  }

  @Post(':id/keys/:keyId/revoke')
  @ApiOperation({ summary: 'Revoke agent API key' })
  revokeKey(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.agentApiKeys.revoke(tenant, id, keyId);
  }

  @Get(':id/keys/:keyId/reveal')
  @ApiOperation({ summary: 'Reveal agent API key plaintext' })
  revealKey(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.agentApiKeys.reveal(tenant, id, keyId);
  }

  @Get(':id/variables')
  @ApiOperation({ summary: 'List assistant variables' })
  listVariables(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.variables.list(tenant, id);
  }

  @Post(':id/variables')
  @ApiOperation({ summary: 'Upsert assistant variables' })
  upsertVariables(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertAgentVariablesDto,
  ) {
    return this.variables.upsertMany(tenant, id, dto);
  }

  @Delete(':id/variables/:key')
  @ApiOperation({ summary: 'Delete assistant variable' })
  deleteVariable(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('key') key: string,
  ) {
    return this.variables.remove(tenant, id, key);
  }

  @Post(':id/render-prompt')
  @ApiOperation({ summary: 'Render system prompt with variables' })
  renderPrompt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RenderPromptDto,
  ) {
    return this.variables.renderPrompt(tenant, id, dto.prompt);
  }

  @Get(':id/knowledge-bindings')
  @ApiOperation({ summary: 'List knowledge base bindings' })
  listKnowledgeBindings(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.kbBindings.list(tenant, id);
  }

  @Post(':id/knowledge-bindings')
  @ApiOperation({ summary: 'Create or update KB binding' })
  upsertKnowledgeBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertKnowledgeBindingDto,
  ) {
    return this.kbBindings.upsert(tenant, id, dto);
  }

  @Patch(':id/knowledge-bindings/:bindingId')
  @ApiOperation({ summary: 'Update KB binding' })
  updateKnowledgeBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateKnowledgeBindingDto,
  ) {
    return this.kbBindings.update(tenant, id, bindingId, dto);
  }

  @Delete(':id/knowledge-bindings/:bindingId')
  @ApiOperation({ summary: 'Remove KB binding' })
  removeKnowledgeBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('bindingId') bindingId: string,
  ) {
    return this.kbBindings.remove(tenant, id, bindingId);
  }

  @Post(':id/context-preview')
  @ApiOperation({ summary: 'Preview retrieval context without LLM' })
  contextPreview(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssistantContextPreviewDto,
  ) {
    return this.context.buildContext(tenant, id, dto.query);
  }

  @Post(':id/chat')
  @ApiOperation({ summary: 'Chat with assistant using KB context' })
  assistantChat(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AssistantChatDto,
  ) {
    return this.chat.chat(tenant, id, dto.query, { debug: dto.debug, model: dto.model });
  }

  @Get(':id/tool-bindings')
  @ApiOperation({ summary: 'List tool bindings' })
  listToolBindings(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.toolBindings.list(tenant, id);
  }

  @Post(':id/tool-bindings')
  @ApiOperation({ summary: 'Create or update tool binding' })
  upsertToolBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpsertToolBindingDto,
  ) {
    return this.toolBindings.upsert(tenant, id, dto);
  }

  @Patch(':id/tool-bindings/:bindingId')
  @ApiOperation({ summary: 'Update tool binding' })
  updateToolBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateToolBindingDto,
  ) {
    return this.toolBindings.update(tenant, id, bindingId, dto);
  }

  @Delete(':id/tool-bindings/:bindingId')
  @ApiOperation({ summary: 'Remove tool binding' })
  removeToolBinding(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('bindingId') bindingId: string,
  ) {
    return this.toolBindings.remove(tenant, id, bindingId);
  }

  @Post(':id/tools/:toolInstanceId/execute')
  @ApiOperation({ summary: 'Execute bound tool for assistant' })
  executeTool(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('toolInstanceId') toolInstanceId: string,
    @Body() dto: ExecuteToolDto,
  ) {
    return this.toolExecution.executeForAssistant(
      tenant,
      id,
      toolInstanceId,
      dto.input ?? {},
      dto.action,
    );
  }
}
