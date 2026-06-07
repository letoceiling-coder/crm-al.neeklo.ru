export type WorkflowTriggerType =
  | 'MANUAL'
  | 'SCHEDULE'
  | 'CRM_EVENT'
  | 'KB_EVENT'
  | 'TOOL_EVENT'
  | 'WEBHOOK'
  | 'INTEGRATION_EVENT';

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type WorkflowStepType =
  | 'START'
  | 'CONDITION'
  | 'ASSISTANT'
  | 'TOOL'
  | 'CRM'
  | 'WEBHOOK'
  | 'WAIT'
  | 'BRANCH'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'END';

export type WorkflowExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DLQ';

export interface WorkflowStep {
  id?: string;
  stepKey: string;
  stepType: WorkflowStepType;
  configuration: Record<string, unknown>;
  position: number;
}

export interface WorkflowVersion {
  id: string;
  version: number;
  published: boolean;
  createdAt: string;
  steps?: WorkflowStep[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  scheduleCron?: string | null;
  scheduleTimezone?: string | null;
  webhookToken?: string | null;
  isActive: boolean;
  currentVersion?: WorkflowVersion | null;
  versions?: WorkflowVersion[];
  _count?: { executions: number };
  updatedAt: string;
}

export interface WorkflowExecutionLog {
  id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string | null;
  latencyMs: number;
  createdAt: string;
  step?: { stepKey: string; stepType: WorkflowStepType } | null;
}

export interface WorkflowExecution {
  id: string;
  status: WorkflowExecutionStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs: number;
  triggerData: Record<string, unknown>;
  result: Record<string, unknown>;
  error?: string | null;
  createdAt: string;
  workflow?: { id: string; name: string };
  logs?: WorkflowExecutionLog[];
}

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  MANUAL: 'Вручную',
  SCHEDULE: 'По расписанию',
  CRM_EVENT: 'Событие CRM',
  KB_EVENT: 'Событие базы знаний',
  TOOL_EVENT: 'Событие инструмента',
  WEBHOOK: 'Webhook',
  INTEGRATION_EVENT: 'Событие интеграции',
};

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  ARCHIVED: 'Архив',
};

export const EXECUTION_STATUS_LABELS: Record<WorkflowExecutionStatus, string> = {
  PENDING: 'Ожидание',
  RUNNING: 'Выполняется',
  WAITING: 'Пауза (async)',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменён',
  DLQ: 'Dead Letter',
};

export const STEP_TYPE_LABELS: Record<WorkflowStepType, string> = {
  START: 'Старт',
  CONDITION: 'Условие',
  ASSISTANT: 'Ассистент',
  TOOL: 'Инструмент',
  CRM: 'CRM',
  WEBHOOK: 'HTTP Webhook',
  WAIT: 'Пауза',
  BRANCH: 'Ветвление',
  MEMORY_READ: 'Чтение памяти',
  MEMORY_WRITE: 'Запись памяти',
  END: 'Конец',
};

export const WORKFLOW_TIMEZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
] as const;

export const CRM_EVENTS = [
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'LEAD_STATUS_CHANGED',
  'CLIENT_CREATED',
  'DEAL_CREATED',
  'TASK_CREATED',
  'NOTE_CREATED',
] as const;

export const KB_EVENTS = [
  'DOCUMENT_CREATED',
  'DOCUMENT_INDEXED',
  'DOCUMENT_REINDEXED',
  'SOURCE_PARSED',
  'INGESTION_FINISHED',
] as const;

export const TOOL_EVENTS = ['TOOL_EXECUTED', 'TOOL_FAILED'] as const;

export const EDITABLE_STEP_TYPES: WorkflowStepType[] = [
  'CONDITION',
  'ASSISTANT',
  'TOOL',
  'CRM',
  'WEBHOOK',
  'WAIT',
  'BRANCH',
  'MEMORY_READ',
  'MEMORY_WRITE',
];

export function defaultSteps(): WorkflowStep[] {
  return [
    { stepKey: 'start', stepType: 'START', position: 0, configuration: {} },
    { stepKey: 'end', stepType: 'END', position: 1, configuration: {} },
  ];
}

export function reorderSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((s, i) => ({ ...s, position: i }));
}
