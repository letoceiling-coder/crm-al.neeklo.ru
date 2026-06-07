import type { KeyAgentDetail } from './assistants';

export interface ReadinessResult {
  percent: number;
  label: string;
  description: string;
  checks: Array<{ id: string; label: string; done: boolean; optional?: boolean }>;
}

function getModelChain(settings: Record<string, unknown>): string[] {
  const chain = settings.modelChain;
  if (!Array.isArray(chain)) return [];
  return chain.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function computeAssistantReadiness(assistant: KeyAgentDetail): ReadinessResult {
  const chain = getModelChain(assistant.settings ?? {});
  const activeKeys = assistant.agentApiKeys.filter((k) => k.status === 'ACTIVE').length;

  const hasName = Boolean(assistant.name?.trim());
  const hasType = Boolean(assistant.agentType);
  const hasPrompt = Boolean(assistant.systemPrompt?.trim());
  const generalDone = hasName && hasType && hasPrompt;
  const modelsDone = chain.length >= 1;
  const keysDone = activeKeys >= 1;

  let percent = 15;
  if (generalDone) percent += 45;
  if (modelsDone) percent += 30;
  if (keysDone) percent += 25;
  percent = Math.min(100, percent);

  let label: string;
  let description: string;
  if (percent >= 100) {
    label = 'Готов к работе';
    description = 'Ассистент настроен: промпт, модели и ключ доступа.';
  } else if (percent >= 60) {
    label = 'Частично настроен';
    description = 'Завершите настройку моделей или ключей доступа.';
  } else {
    label = 'Не настроен';
    description = 'Заполните основные параметры и создайте ключ доступа.';
  }

  return {
    percent,
    label,
    description,
    checks: [
      { id: 'general', label: 'Основное (название, тип, промпт)', done: generalDone },
      { id: 'models', label: 'Основная модель', done: modelsDone },
      { id: 'keys', label: 'Ключ доступа agt_', done: keysDone },
      { id: 'variables', label: 'Переменные', done: assistant.variables.some((v) => v.value.trim()), optional: true },
    ],
  };
}
