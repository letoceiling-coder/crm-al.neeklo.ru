export type AgentType =
  | 'LAWYER'
  | 'MARKETING'
  | 'DEVELOPER'
  | 'SALES'
  | 'SUPPORT'
  | 'HR'
  | 'REAL_ESTATE'
  | 'EDUCATION'
  | 'ASSISTANT'
  | 'CUSTOM';

export type AgentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type AgentApiKeyEnvironment =
  | 'PRODUCTION'
  | 'TEST'
  | 'CRM'
  | 'TELEGRAM'
  | 'WEBHOOK'
  | 'INTERNAL';

export type AgentApiKeyScope =
  | 'CHAT'
  | 'TOOLS_INVOKE'
  | 'KB_READ'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'CRM_READ'
  | 'CRM_WRITE'
  | 'ADMIN';

export interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  agentType: AgentType;
  isPublic: boolean;
  isMarketplace: boolean;
  defaultPrompt: string;
  defaultSettings: Record<string, unknown>;
  installCount?: number;
}

export interface KeyAgentListItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  agentType: AgentType;
  status: AgentStatus;
  systemPrompt: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string; slug: string; agentType?: AgentType } | null;
  _count?: { agentApiKeys: number; variables: number };
}

export interface KeyAgentDetail extends KeyAgentListItem {
  variables: AgentVariable[];
  agentApiKeys: AgentApiKeyListItem[];
  template?: AgentTemplate | null;
}

export interface AgentVariable {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentApiKeyListItem {
  id: string;
  name: string;
  environment: AgentApiKeyEnvironment;
  scopes: AgentApiKeyScope[];
  keyPrefix: string;
  status: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface RenderPromptResult {
  rendered: string;
  missing: string[];
  placeholders: string[];
  standardVariables: string[];
}

export {
  AGENT_TYPE_LABELS,
  AGENT_STATUS_LABELS,
  ENV_LABELS,
  SCOPE_LABELS,
  VARIABLE_LABELS,
  KEY_STATUS_LABELS,
  variableLabel,
} from './assistants-i18n';

export const STANDARD_VARIABLES = [
  'company_name',
  'phone',
  'email',
  'website',
  'crm_url',
] as const;

export type AssistantSearchMode = 'KEYWORD' | 'VECTOR' | 'HYBRID';

export interface AssistantKnowledgeBinding {
  id: string;
  assistantId: string;
  knowledgeBaseId: string;
  enabled: boolean;
  priority: number;
  maxChunks: number;
  maxTokens: number;
  searchMode: AssistantSearchMode;
  keywordWeight: number;
  vectorWeight: number;
  knowledgeBase?: { id: string; name: string; slug: string; status: string };
}

export interface ContextPreviewResult {
  query: string;
  contextText: string;
  chunks: Array<{
    chunkId: string;
    documentId: string;
    documentTitle?: string | null;
    knowledgeBaseId: string;
    knowledgeBaseName: string;
    content: string;
    score: number;
  }>;
  chunksFound: number;
  chunksUsed: number;
  tokensUsed: number;
  latencyMs: number;
  bindingsUsed: number;
}

export const SEARCH_MODE_LABELS: Record<AssistantSearchMode, string> = {
  KEYWORD: 'Ключевые слова',
  VECTOR: 'Векторный',
  HYBRID: 'Гибридный',
};
