export const CRM_WORKFLOW_EVENTS = [
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'LEAD_STATUS_CHANGED',
  'CLIENT_CREATED',
  'DEAL_CREATED',
  'TASK_CREATED',
  'NOTE_CREATED',
] as const;

export const KB_WORKFLOW_EVENTS = [
  'DOCUMENT_CREATED',
  'DOCUMENT_INDEXED',
  'DOCUMENT_REINDEXED',
  'SOURCE_PARSED',
  'INGESTION_FINISHED',
] as const;

export const TOOL_WORKFLOW_EVENTS = ['TOOL_EXECUTED', 'TOOL_FAILED'] as const;

export type CrmWorkflowEvent = (typeof CRM_WORKFLOW_EVENTS)[number];
export type KbWorkflowEvent = (typeof KB_WORKFLOW_EVENTS)[number];
export type ToolWorkflowEvent = (typeof TOOL_WORKFLOW_EVENTS)[number];

export const WORKFLOW_RETRY_ATTEMPTS = 3;
export const WORKFLOW_RETRY_BACKOFF_MS = [5000, 30000, 120000];
export const WORKFLOW_MAX_STEPS = 20;
