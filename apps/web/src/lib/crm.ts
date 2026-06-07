export type CrmPipelineStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export type CrmClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CrmTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type CrmTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CrmClient {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  tags: string[];
  status: CrmClientStatus;
  owner?: { id: string; name?: string | null; email: string };
  updatedAt: string;
  timeline?: TimelineItem[];
}

export interface CrmLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: CrmPipelineStage;
  score: number;
  assignedTo?: { id: string; name?: string | null; email: string };
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  name: string;
  amount: string | number;
  currency: string;
  status: CrmPipelineStage;
  client?: { id: string; name: string };
  lead?: { id: string; name: string };
  updatedAt: string;
}

export interface CrmTask {
  id: string;
  title: string;
  description?: string | null;
  status: CrmTaskStatus;
  priority: CrmTaskPriority;
  dueDate?: string | null;
  assignedTo?: { id: string; name?: string | null; email: string };
  updatedAt: string;
}

export interface TimelineItem {
  kind: 'activity' | 'note';
  id: string;
  createdAt: string;
  action?: string;
  metadata?: Record<string, unknown>;
  content?: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
}

export interface CrmOverview {
  workspace: { id: string; name: string; status: string };
  counts: { clients: number; leads: number; deals: number; tasks: number };
  pipeline: Array<{ stage: CrmPipelineStage; count: number }>;
}

export const PIPELINE_LABELS: Record<CrmPipelineStage, string> = {
  NEW: 'Новый',
  CONTACTED: 'Связались',
  QUALIFIED: 'Квалификация',
  PROPOSAL: 'Предложение',
  WON: 'Успешно',
  LOST: 'Проиграно',
};

export const PIPELINE_STAGES: CrmPipelineStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
];

export const CLIENT_STATUS_LABELS: Record<CrmClientStatus, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  ARCHIVED: 'Архив',
};

export const TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  TODO: 'К выполнению',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  CANCELLED: 'Отменена',
};
