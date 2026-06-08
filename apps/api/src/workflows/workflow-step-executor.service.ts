import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { WorkflowStepType } from '@prisma/client';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { AssistantChatService } from '../assistants/assistant-chat.service';
import { ToolExecutionService } from '../tools/tool-execution.service';
import { CrmToolService } from '../crm/crm-tool.service';
import { CrmLeadService } from '../crm/crm-lead.service';
import { CrmClientService } from '../crm/crm-client.service';
import { CrmTaskService } from '../crm/crm-task.service';
import { CrmNoteService } from '../crm/crm-note.service';
import { MemorySearchService } from '../memory/memory-search.service';
import { MemoryEntryService } from '../memory/memory-entry.service';
import { CrmEntityType } from '@prisma/client';
import { StepExecutionResult, WorkflowGraphEngine } from './workflow-graph.engine';

export type WorkflowContext = Record<string, unknown>;

@Injectable()
export class WorkflowStepExecutorService {
  private readonly graph = new WorkflowGraphEngine();

  constructor(
    @Inject(forwardRef(() => AssistantChatService))
    private chat: AssistantChatService,
    @Inject(forwardRef(() => ToolExecutionService))
    private tools: ToolExecutionService,
    @Inject(forwardRef(() => CrmToolService))
    private crmTools: CrmToolService,
    @Inject(forwardRef(() => CrmLeadService))
    private leads: CrmLeadService,
    @Inject(forwardRef(() => CrmClientService))
    private clients: CrmClientService,
    @Inject(forwardRef(() => CrmTaskService))
    private tasks: CrmTaskService,
    @Inject(forwardRef(() => CrmNoteService))
    private notes: CrmNoteService,
    @Inject(forwardRef(() => MemorySearchService))
    private memorySearch: MemorySearchService,
    @Inject(forwardRef(() => MemoryEntryService))
    private memoryEntries: MemoryEntryService,
  ) {}

  async execute(
    tenant: TenantContext,
    stepType: WorkflowStepType,
    configuration: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<StepExecutionResult> {
    switch (stepType) {
      case WorkflowStepType.START:
        return { output: { trigger: context.trigger ?? {} } };
      case WorkflowStepType.END:
        return { output: { finished: true } };
      case WorkflowStepType.WAIT:
        return this.executeWait(configuration);
      case WorkflowStepType.CONDITION:
        return this.executeCondition(configuration, context);
      case WorkflowStepType.BRANCH:
        return this.executeBranch(configuration, context);
      case WorkflowStepType.ASSISTANT:
        return this.executeAssistant(tenant, configuration, context);
      case WorkflowStepType.TOOL:
        return this.executeTool(tenant, configuration, context);
      case WorkflowStepType.CRM:
        return this.executeCrm(tenant, configuration, context);
      case WorkflowStepType.WEBHOOK:
        return this.executeWebhook(configuration, context);
      case WorkflowStepType.MEMORY_READ:
        return this.executeMemoryRead(tenant, configuration, context);
      case WorkflowStepType.MEMORY_WRITE:
        return this.executeMemoryWrite(tenant, configuration, context);
      default:
        return { output: { skipped: true, stepType } };
    }
  }

  private async executeWait(config: Record<string, unknown>): Promise<StepExecutionResult> {
    const totalMs = this.graph.computeWaitMs(config);
    if (totalMs <= 0) return { output: { waitedMs: 0, mode: 'none' } };

    if (totalMs <= WorkflowGraphEngine.syncWaitCapMs) {
      await new Promise((r) => setTimeout(r, totalMs));
      return { output: { waitedMs: totalMs, mode: 'sync' } };
    }

    return {
      output: { waitedMs: totalMs, mode: 'async', resumeAt: new Date(Date.now() + totalMs).toISOString() },
      asyncWait: true,
      waitMs: totalMs,
    };
  }

  private executeCondition(config: Record<string, unknown>, context: WorkflowContext) {
    const ok = this.evaluate(config, context);
    return {
      output: { passed: ok },
      skipRemaining: !ok && config.onFalse === 'skip_remaining',
    };
  }

  private executeBranch(config: Record<string, unknown>, context: WorkflowContext): StepExecutionResult {
    const ok = this.evaluate(config, context);
    const nextStepKey = ok ? config.trueStepKey : config.falseStepKey;
    return {
      output: { branch: ok ? 'true' : 'false', nextStepKey },
      nextStepKeys: nextStepKey ? [String(nextStepKey)] : [],
    };
  }

  private async executeAssistant(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: WorkflowContext,
  ) {
    const assistantId = String(config.assistantId ?? '');
    const template = String(config.promptTemplate ?? '{{trigger.query}}');
    const query = this.renderTemplate(template, context);
    const result = await this.chat.chat(tenant, assistantId, query);
    return { output: { answer: result.answer, chunksUsed: result.chunksUsed, sources: result.sources } };
  }

  private async executeTool(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: WorkflowContext,
  ) {
    const toolInstanceId = String(config.toolInstanceId ?? '');
    const payload = (config.payload ?? context.trigger ?? {}) as Record<string, unknown>;
    const result = await this.tools.execute(tenant, toolInstanceId, payload);
    return { output: result.output };
  }

  private async executeCrm(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: WorkflowContext,
  ) {
    const entityType = String(config.entityType ?? '').toUpperCase();
    const action = String(config.action ?? 'create').toLowerCase();
    const data = (config.data ?? context.trigger ?? {}) as Record<string, unknown>;

    if (action === 'create') {
      if (entityType === 'LEAD') {
        const lead = await this.leads.create(tenant, {
          name: String(data.name ?? 'Workflow Lead'),
          email: data.email ? String(data.email) : undefined,
          phone: data.phone ? String(data.phone) : undefined,
        });
        return { output: { entity: 'lead', id: lead.id, lead } };
      }
      if (entityType === 'CLIENT') {
        const client = await this.clients.create(tenant, {
          name: String(data.name ?? 'Workflow Client'),
          phone: data.phone ? String(data.phone) : undefined,
        });
        return { output: { entity: 'client', id: client.id, client } };
      }
      if (entityType === 'TASK') {
        const task = await this.tasks.create(tenant, {
          title: String(data.title ?? 'Workflow Task'),
          description: data.description ? String(data.description) : undefined,
        });
        return { output: { entity: 'task', id: task.id, task } };
      }
      if (entityType === 'NOTE') {
        const note = await this.notes.create(tenant, {
          entityType: (data.entityType as CrmEntityType) ?? CrmEntityType.CLIENT,
          entityId: String(data.entityId ?? ''),
          content: String(data.content ?? data.text ?? ''),
        });
        return { output: { entity: 'note', id: note.id, note } };
      }
    }

    const slugMap: Record<string, string> = {
      LEAD: 'create-lead',
      CLIENT: 'create-client',
      TASK: 'create-task',
      NOTE: 'create-note',
    };
    const slug = slugMap[entityType];
    if (slug) {
      const result = await this.crmTools.executeTool(tenant, slug, data);
      return { output: result };
    }
    throw new Error(`Unsupported CRM action: ${entityType}/${action}`);
  }

  private async executeWebhook(config: Record<string, unknown>, context: WorkflowContext) {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'POST').toUpperCase();
    if (!url) throw new Error('Webhook URL required');
    const body = config.body ?? context;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...((config.headers as Record<string, string>) ?? {}) },
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
    return { output: { status: res.status, body: parsed } };
  }

  private async executeMemoryRead(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: WorkflowContext,
  ) {
    const result = await this.memorySearch.readForWorkflow(tenant, config, context);
    return { output: result };
  }

  private async executeMemoryWrite(
    tenant: TenantContext,
    config: Record<string, unknown>,
    context: WorkflowContext,
  ) {
    const result = await this.memoryEntries.writeForWorkflow(tenant, config, context);
    return { output: result };
  }

  private evaluate(config: Record<string, unknown>, context: WorkflowContext): boolean {
    const field = String(config.field ?? '');
    const operator = String(config.operator ?? 'equals');
    const expected = config.value;
    const actual = this.getPath(context, field);

    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual ?? '').includes(String(expected ?? ''));
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'exists':
        return actual !== undefined && actual !== null && actual !== '';
      default:
        return false;
    }
  }

  private getPath(obj: WorkflowContext, path: string): unknown {
    if (!path) return undefined;
    const parts = path.replace(/^trigger\./, 'trigger.').split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  private renderTemplate(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
      const val = this.getPath(context, key.trim());
      return val !== undefined && val !== null ? String(val) : '';
    });
  }
}
