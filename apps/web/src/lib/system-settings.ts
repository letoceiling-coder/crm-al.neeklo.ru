import { api } from './api';

export const systemSettingsApi = {
  getGeneral: () => api.get('/v1/system/settings/general').then((r) => r.data),
  updateGeneral: (body: { publicUrl: string }) =>
    api.patch('/v1/system/settings/general', body).then((r) => r.data),

  getPayments: () => api.get('/v1/system/settings/payments').then((r) => r.data),
  updatePayment: (
    provider: string,
    body: { isEnabled?: boolean; testMode?: boolean; shopId?: string; secretKey?: string },
  ) => api.patch(`/v1/system/settings/payments/${provider}`, body).then((r) => r.data),
  setDefaultPayment: (provider: string) =>
    api.post(`/v1/system/settings/payments/${provider}/default`).then((r) => r.data),
  testPayment: (provider: string) =>
    api.post(`/v1/system/settings/payments/${provider}/test`).then((r) => r.data),
  createTestPayment: () =>
    api.post('/v1/system/settings/payments/yookassa/test-payment').then((r) => r.data),

  getParser: () => api.get('/v1/system/settings/parser').then((r) => r.data),
  updateParser: (body: { baseUrl?: string; apiKey?: string }) =>
    api.patch('/v1/system/settings/parser', body).then((r) => r.data),

  getEmail: () => api.get('/v1/system/settings/email').then((r) => r.data),
  updateEmail: (body: {
    host: string;
    port: number;
    tls: boolean;
    user: string;
    from: string;
    password?: string;
  }) => api.patch('/v1/system/settings/email', body).then((r) => r.data),
  testEmailConnection: () => api.post('/v1/system/settings/email/test-connection').then((r) => r.data),
  sendTestEmail: (to: string) =>
    api.post('/v1/system/settings/email/test-send', { to }).then((r) => r.data),

  getAlerts: () => api.get('/v1/system/settings/alerts').then((r) => r.data),
  updateAlerts: (body: Record<string, unknown>) =>
    api.patch('/v1/system/settings/alerts', body).then((r) => r.data),
  testAlert: () => api.post('/v1/system/settings/alerts/test').then((r) => r.data),

  getRegistration: () => api.get('/v1/system/settings/registration').then((r) => r.data),
  updateRegistration: (body: Record<string, unknown>) =>
    api.patch('/v1/system/settings/registration', body).then((r) => r.data),

  getBilling: () => api.get('/v1/system/settings/billing').then((r) => r.data),
  updateBilling: (body: Record<string, unknown>) =>
    api.patch('/v1/system/settings/billing', body).then((r) => r.data),

  getIntegrationHealth: () => api.get('/v1/system/settings/health').then((r) => r.data),
  getLaunch: () => api.get('/v1/system/launch').then((r) => r.data),
};
