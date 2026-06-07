export type MemoryProfileEntityType =
  | 'USER'
  | 'ASSISTANT'
  | 'ORGANIZATION'
  | 'CLIENT'
  | 'WORKFLOW';

export type MemoryProfileStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type MemoryEntryType =
  | 'FACT'
  | 'SUMMARY'
  | 'NOTE'
  | 'PREFERENCE'
  | 'RULE'
  | 'OBSERVATION';

export type MemorySearchMode = 'KEYWORD' | 'VECTOR' | 'HYBRID';

export interface MemoryProfile {
  id: string;
  name: string;
  entityType: MemoryProfileEntityType;
  entityId: string;
  status: MemoryProfileStatus;
  settings: Record<string, unknown>;
  updatedAt: string;
  _count?: { entries: number; summaries: number };
  summaries?: MemorySummary[];
}

export interface MemoryEntry {
  id: string;
  content: string;
  entryType: MemoryEntryType;
  importance: number;
  source?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MemorySummary {
  id: string;
  summary: string;
  period: string;
  tokensSaved: number;
  entryCount: number;
  createdAt: string;
}

export interface MemorySearchHit {
  entryId: string;
  content: string;
  entryType: string;
  importance: number;
  score: number;
  source?: string | null;
  reason?: string;
}

export interface MemorySearchLog {
  id: string;
  query: string;
  mode: MemorySearchMode;
  resultCount: number;
  latencyMs: number;
  results: MemorySearchHit[];
  debug: Record<string, unknown>;
  createdAt: string;
  profileId?: string | null;
}

export const ENTITY_TYPE_LABELS: Record<MemoryProfileEntityType, string> = {
  USER: 'Пользователь',
  ASSISTANT: 'Ассистент',
  ORGANIZATION: 'Организация',
  CLIENT: 'Клиент CRM',
  WORKFLOW: 'Workflow',
};

export const ENTRY_TYPE_LABELS: Record<MemoryEntryType, string> = {
  FACT: 'Факт',
  SUMMARY: 'Сводка',
  NOTE: 'Заметка',
  PREFERENCE: 'Предпочтение',
  RULE: 'Правило',
  OBSERVATION: 'Наблюдение',
};

export const SEARCH_MODE_LABELS: Record<MemorySearchMode, string> = {
  KEYWORD: 'Ключевые слова',
  VECTOR: 'Семантика',
  HYBRID: 'Гибридный',
};
