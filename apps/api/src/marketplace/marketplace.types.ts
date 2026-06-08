import {
  AgentType,
  MarketplacePackageType,
  WorkflowStepType,
  WorkflowTriggerType,
} from '@prisma/client';

export interface MarketplaceManifestAssistant {
  name: string;
  description?: string;
  agentType?: AgentType;
  systemPrompt: string;
  settings?: Record<string, unknown>;
  variables?: Array<{ key: string; value: string }>;
}

export interface MarketplaceManifestWorkflowStep {
  stepKey: string;
  stepType: WorkflowStepType;
  position: number;
  configuration: Record<string, unknown>;
}

export interface MarketplaceManifestWorkflow {
  name: string;
  description?: string;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  scheduleCron?: string;
  steps: MarketplaceManifestWorkflowStep[];
  graph?: Record<string, unknown>;
}

export interface MarketplaceManifestTool {
  definitionSlug: string;
  name: string;
  settings?: Record<string, unknown>;
}

export interface MarketplaceManifestKnowledgeTemplate {
  name: string;
  description?: string;
  topics?: string[];
  categories?: string[];
}

export interface MarketplaceManifestMemoryRule {
  profileType: string;
  rules: Record<string, unknown>;
}

export interface MarketplaceManifest {
  type: MarketplacePackageType;
  assistant?: MarketplaceManifestAssistant;
  workflow?: MarketplaceManifestWorkflow;
  tools?: MarketplaceManifestTool[];
  knowledgeTemplate?: MarketplaceManifestKnowledgeTemplate;
  memoryRules?: MarketplaceManifestMemoryRule[];
  variables?: Record<string, unknown>;
  configurations?: Record<string, unknown>;
}

export interface ClonedEntities {
  assistantId?: string;
  workflowId?: string;
  toolInstanceIds?: string[];
  knowledgeBaseId?: string;
}

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
