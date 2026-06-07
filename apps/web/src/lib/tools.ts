export type ToolProviderType = 'INTERNAL' | 'WEBHOOK' | 'REST_API' | 'GRAPHQL' | 'MCP';
export type ToolInstanceStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';
export type ToolExecutionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  providerType: ToolProviderType;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  provider?: { slug: string; name: string; providerType: ToolProviderType };
}

export interface ToolInstance {
  id: string;
  name: string;
  status: ToolInstanceStatus;
  settings: Record<string, unknown>;
  lastTestedAt?: string | null;
  lastTestStatus?: ToolExecutionStatus | null;
  definition: {
    slug: string;
    name: string;
    providerType: ToolProviderType;
    description?: string | null;
    metadata?: Record<string, unknown>;
  };
  executionLogs?: Array<{
    id: string;
    status: ToolExecutionStatus;
    latencyMs: number;
    createdAt: string;
    error?: string | null;
  }>;
  _count?: { bindings: number };
}

export interface AssistantToolBinding {
  id: string;
  assistantId: string;
  toolInstanceId: string;
  enabled: boolean;
  priority: number;
  allowedActions: string[];
  toolInstance: ToolInstance;
}

export const PROVIDER_TYPE_LABELS: Record<ToolProviderType, string> = {
  INTERNAL: 'Встроенный',
  WEBHOOK: 'Webhook',
  REST_API: 'REST API',
  GRAPHQL: 'GraphQL',
  MCP: 'MCP',
};

export const INSTANCE_STATUS_LABELS: Record<ToolInstanceStatus, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Отключён',
  ERROR: 'Ошибка',
};
