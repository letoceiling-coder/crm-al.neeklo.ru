export type AppRole =
  | 'api'
  | 'worker-knowledge'
  | 'worker-workflow'
  | 'worker-memory'
  | 'worker-integrations'
  | 'worker-tools'
  | 'all';

export function getAppRole(): AppRole {
  return (process.env.APP_ROLE ?? 'api') as AppRole;
}

export function isApiProcess(): boolean {
  return getAppRole() === 'api';
}

export function shouldRunKnowledgeWorkers(): boolean {
  const role = getAppRole();
  return role === 'all' || role === 'worker-knowledge';
}

export function shouldRunWorkflowWorkers(): boolean {
  const role = getAppRole();
  return role === 'all' || role === 'worker-workflow';
}

export function shouldRunMemoryWorkers(): boolean {
  const role = getAppRole();
  return role === 'all' || role === 'worker-memory';
}

export function shouldRunIntegrationWorkers(): boolean {
  const role = getAppRole();
  return role === 'all' || role === 'worker-integrations';
}

export function shouldRunToolWorkers(): boolean {
  const role = getAppRole();
  return role === 'all' || role === 'worker-tools';
}
