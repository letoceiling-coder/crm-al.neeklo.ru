import type { AgentType, AgentStatus, AgentApiKeyEnvironment, AgentApiKeyScope } from './assistants';

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  LAWYER: 'Юрист',
  MARKETING: 'Маркетолог',
  DEVELOPER: 'Разработчик',
  SALES: 'Продажи',
  SUPPORT: 'Поддержка',
  HR: 'HR',
  REAL_ESTATE: 'Недвижимость',
  EDUCATION: 'Образование',
  ASSISTANT: 'Универсальный ассистент',
  CUSTOM: 'Пользовательский',
};

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  INACTIVE: 'Неактивен',
  ARCHIVED: 'Архив',
};

export const ENV_LABELS: Record<AgentApiKeyEnvironment, string> = {
  PRODUCTION: 'Продакшен',
  TEST: 'Тест',
  CRM: 'CRM',
  TELEGRAM: 'Telegram',
  WEBHOOK: 'Webhook',
  INTERNAL: 'Внутренний',
};

export const SCOPE_LABELS: Record<AgentApiKeyScope, string> = {
  CHAT: 'Чат',
  TOOLS_INVOKE: 'Инструменты',
  KB_READ: 'База знаний (чтение)',
  MEMORY_READ: 'Память (чтение)',
  MEMORY_WRITE: 'Память (запись)',
  CRM_READ: 'CRM (чтение)',
  CRM_WRITE: 'CRM (запись)',
  ADMIN: 'Администрирование',
};

export const VARIABLE_LABELS: Record<string, string> = {
  company_name: 'Название компании',
  phone: 'Телефон',
  email: 'Email',
  website: 'Сайт',
  crm_url: 'Ссылка на CRM',
};

export const KEY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'Отозван',
  BLOCKED: 'Заблокирован',
  LIMIT_EXCEEDED: 'Лимит превышен',
};

export function variableLabel(key: string): string {
  return VARIABLE_LABELS[key] ?? key;
}
