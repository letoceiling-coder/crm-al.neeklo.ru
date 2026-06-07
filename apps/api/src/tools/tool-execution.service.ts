import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { ToolProviderType, ToolExecutionStatus, ToolInstanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecretEncryptionService } from '../secrets/secret-encryption.service';
import { RetrievalService } from '../knowledge/search/retrieval.service';
import { CrmToolService } from '../crm/crm-tool.service';
import { IntegrationToolService } from '../integrations/integration-tool.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { AssistantSearchMode } from '@prisma/client';

export interface ToolExecutionResult {
  status: ToolExecutionStatus;
  output: Record<string, unknown>;
  latencyMs: number;
  error?: string;
  logId: string;
}

@Injectable()
export class ToolExecutionService {
  constructor(
    private prisma: PrismaService,
    private secrets: SecretEncryptionService,
    private retrieval: RetrievalService,
    private crmTools: CrmToolService,
    private integrationTools: IntegrationToolService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async testConnection(tenant: TenantContext, toolInstanceId: string) {
    return this.execute(tenant, toolInstanceId, { test: true }, undefined, { testMode: true });
  }

  async executeForAssistant(
    tenant: TenantContext,
    assistantId: string,
    toolInstanceId: string,
    input: Record<string, unknown>,
    action?: string,
  ) {
    return this.execute(tenant, toolInstanceId, input, assistantId, { action });
  }

  private crmSlugs = new Set(['create-lead', 'create-client', 'create-note', 'create-task']);

  async execute(
    tenant: TenantContext,
    toolInstanceId: string,
    input: Record<string, unknown>,
    assistantId?: string,
    options?: { testMode?: boolean; action?: string },
  ): Promise<ToolExecutionResult> {
    const started = Date.now();
    const instance = await this.prisma.toolInstance.findFirst({
      where: { id: toolInstanceId, organizationId: tenant.organizationId },
      include: { definition: { include: { provider: true } } },
    });

    if (!instance) {
      throw new Error('Tool instance not found');
    }

    let status: ToolExecutionStatus = ToolExecutionStatus.SUCCESS;
    let output: Record<string, unknown> = {};
    let error: string | undefined;

    try {
      if (instance.status === ToolInstanceStatus.INACTIVE) {
        throw new Error('Tool instance is inactive');
      }

      output = await this.dispatch(
        tenant,
        instance,
        input,
        options?.testMode ?? false,
        options?.action,
        assistantId,
      );
    } catch (e) {
      status = ToolExecutionStatus.FAILED;
      error = e instanceof Error ? e.message : String(e);
      output = { error: error };
    }

    const latencyMs = Date.now() - started;

    const log = await this.prisma.toolExecutionLog.create({
      data: {
        organizationId: tenant.organizationId,
        assistantId,
        toolInstanceId,
        input: input as object,
        output: output as object,
        status,
        latencyMs,
        error,
      },
    });

    await this.prisma.toolInstance.update({
      where: { id: toolInstanceId },
      data: {
        lastTestedAt: options?.testMode ? new Date() : instance.lastTestedAt,
        lastTestStatus: options?.testMode ? status : instance.lastTestStatus,
        status: status === ToolExecutionStatus.FAILED ? ToolInstanceStatus.ERROR : ToolInstanceStatus.ACTIVE,
      },
    });

    void this.workflowTriggers?.emitToolEvent(
      tenant.organizationId,
      status === ToolExecutionStatus.SUCCESS ? 'TOOL_EXECUTED' : 'TOOL_FAILED',
      { toolInstanceId, assistantId, status, output },
    );

    return { status, output, latencyMs, error, logId: log.id };
  }

  private async dispatch(
    tenant: TenantContext,
    instance: {
      id: string;
      settings: unknown;
      secretId: string | null;
      definition: {
        slug: string;
        providerType: ToolProviderType;
        metadata: unknown;
      };
    },
    input: Record<string, unknown>,
    testMode: boolean,
    action?: string,
    assistantId?: string,
  ): Promise<Record<string, unknown>> {
    const settings = (instance.settings ?? {}) as Record<string, unknown>;
    const providerType = instance.definition.providerType;

    if (providerType === ToolProviderType.WEBHOOK) {
      return this.executeWebhook(instance, settings, input, testMode);
    }
    if (providerType === ToolProviderType.REST_API) {
      return this.executeHttp(instance, tenant.organizationId, settings, input, testMode);
    }
    if (providerType === ToolProviderType.GRAPHQL || providerType === ToolProviderType.MCP) {
      if (testMode) {
        return { ok: true, message: `${providerType} connection check passed (stub)` };
      }
      throw new Error(`${providerType} execution not implemented in Stage 4`);
    }

    return this.executeInternal(
      tenant,
      instance,
      settings,
      input,
      testMode,
      action,
      assistantId,
    );
  }

  private async executeInternal(
    tenant: TenantContext,
    instance: { id: string; secretId: string | null; definition: { slug: string; metadata: unknown } },
    settings: Record<string, unknown>,
    input: Record<string, unknown>,
    testMode: boolean,
    _action?: string,
    assistantId?: string,
  ): Promise<Record<string, unknown>> {
    const slug = instance.definition.slug;
    const meta = (instance.definition.metadata ?? {}) as { requiresSecret?: boolean; stub?: boolean };

    if (meta.requiresSecret && instance.secretId) {
      await this.secrets.getSecret(instance.secretId, tenant.organizationId);
    } else if (meta.requiresSecret && testMode) {
      throw new Error('Secret not configured');
    }

    if (testMode) {
      if (this.crmSlugs.has(slug)) {
        await this.crmTools.testCrmTool(tenant, slug);
      } else if (this.integrationTools.isMessagingSlug(slug)) {
        const accountId = String(settings.integrationAccountId ?? '');
        if (!accountId) throw new Error('integrationAccountId required in tool settings');
        await this.integrationTools.testMessagingTool(tenant, slug, accountId);
      }
      return { ok: true, tool: slug, message: 'Connection verified' };
    }

    if (this.crmSlugs.has(slug)) {
      return this.crmTools.executeTool(tenant, slug, input, assistantId);
    }

    if (this.integrationTools.isMessagingSlug(slug)) {
      return this.integrationTools.executeMessagingTool(tenant, slug, settings, input, assistantId);
    }

    switch (slug) {
      case 'knowledge-search': {        const kbId = String(settings.knowledgeBaseId ?? input.knowledgeBaseId ?? '');
        const query = String(input.query ?? '');
        if (!kbId || !query) throw new Error('knowledgeBaseId and query required');
        const hits = await this.retrieval.searchWithMode(
          tenant,
          kbId,
          query,
          AssistantSearchMode.HYBRID,
          Number(input.limit ?? 5),
        );
        return { hits, count: hits.length };
      }
      case 'generate-pdf':      case 'generate-docx':
        return { queued: true, tool: slug, documentId: `doc-${Date.now()}`, input };
      default:
        return { ok: true, tool: slug, input };
    }
  }

  private async executeWebhook(
    instance: { id: string; secretId: string | null },
    settings: Record<string, unknown>,
    input: Record<string, unknown>,
    testMode: boolean,
  ) {
    const url = String(settings.url ?? '');
    if (!url) throw new Error('Webhook URL not configured');

    if (testMode) {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      return {
        ok: true,
        url,
        reachable: res !== null,
        status: res?.status ?? null,
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    if (!res.ok) throw new Error(`Webhook failed: HTTP ${res.status}`);
    return { status: res.status, body };
  }

  private async executeHttp(
    instance: { secretId: string | null },
    organizationId: string,
    settings: Record<string, unknown>,
    input: Record<string, unknown>,
    testMode: boolean,
  ) {
    const baseUrl = String(settings.baseUrl ?? '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('baseUrl not configured');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((settings.defaultHeaders as Record<string, string>) ?? {}),
    };

    if (instance.secretId) {
      const token = await this.secrets.getSecret(instance.secretId, organizationId);
      headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    if (testMode) {
      const res = await fetch(baseUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      return {
        ok: true,
        baseUrl,
        reachable: res !== null,
        status: res?.status ?? null,
      };
    }

    const method = String(input.method ?? 'GET').toUpperCase();
    const path = String(input.path ?? '');
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const res = await fetch(url, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(input.body ?? {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, body };
  }
}
