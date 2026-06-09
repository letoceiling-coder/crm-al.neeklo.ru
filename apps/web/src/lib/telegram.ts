import { api } from './api';

export const telegramApi = {
  getSettings: () => api.get('/v1/system/telegram/settings').then((r) => r.data),
  updateSettings: (body: { botToken?: string }) =>
    api.patch('/v1/system/telegram/settings', body).then((r) => r.data),
  testConnection: () => api.post('/v1/system/telegram/settings/test').then((r) => r.data),
  registerWebhook: () => api.post('/v1/system/telegram/settings/register-webhook').then((r) => r.data),
  listUsers: (status?: string) =>
    api.get('/v1/system/telegram/users', { params: status ? { status } : {} }).then((r) => r.data),
  approveUser: (id: string) => api.post(`/v1/system/telegram/users/${id}/approve`).then((r) => r.data),
  rejectUser: (id: string) => api.post(`/v1/system/telegram/users/${id}/reject`).then((r) => r.data),
  listNotifications: (params?: Record<string, string>) =>
    api.get('/v1/system/telegram/notifications', { params }).then((r) => r.data),
};
