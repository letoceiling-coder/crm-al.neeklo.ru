import { Module, forwardRef } from '@nestjs/common';
import { AssistantsController } from './assistants.controller';
import { AgentTemplateService } from './agent-template.service';
import { KeyAgentService } from './key-agent.service';
import { AgentApiKeyService } from './agent-api-key.service';
import { AgentVariableService } from './agent-variable.service';
import { PromptRenderService } from './prompt-render.service';
import { AssistantKnowledgeBindingService } from './assistant-knowledge-binding.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantChatService } from './assistant-chat.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { ToolsModule } from '../tools/tools.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [KnowledgeModule, OpenRouterModule, ToolsModule, forwardRef(() => MemoryModule)],
  controllers: [AssistantsController],
  providers: [
    AgentTemplateService,
    KeyAgentService,
    AgentApiKeyService,
    AgentVariableService,
    PromptRenderService,
    AssistantKnowledgeBindingService,
    AssistantContextService,
    AssistantChatService,
  ],
  exports: [
    AgentTemplateService,
    KeyAgentService,
    AgentApiKeyService,
    AgentVariableService,
    PromptRenderService,
    AssistantKnowledgeBindingService,
    AssistantContextService,
    AssistantChatService,
  ],
})
export class AssistantsModule {}
