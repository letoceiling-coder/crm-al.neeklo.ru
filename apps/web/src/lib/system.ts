import { api } from './api';

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  health: string;
  lagMs: number | null;
}

export const systemApi = {
  getQueues: () => api.get('/v1/system/queues').then((r) => r.data),
  getMetrics: () => api.get('/v1/system/metrics').then((r) => r.data),
  getHealth: () => api.get('/v1/system/health').then((r) => r.data),
  getDependencies: () => api.get('/v1/system/dependencies').then((r) => r.data),
  getSecurity: () => api.get('/v1/system/security').then((r) => r.data),
  getCostAnomalies: () => api.get('/v1/system/cost-anomalies').then((r) => r.data),
};
