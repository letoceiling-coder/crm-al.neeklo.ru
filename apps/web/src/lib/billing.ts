import { api } from './api';

export const billingApi = {
  getPlans: () => api.get('/v1/billing/plans').then((r) => r.data),
  getSubscription: () => api.get('/v1/billing/subscription').then((r) => r.data),
  changePlan: (tier: string) => api.post('/v1/billing/subscription/change', { tier }).then((r) => r.data),
  cancelSubscription: () => api.post('/v1/billing/subscription/cancel').then((r) => r.data),
  renewSubscription: () => api.post('/v1/billing/subscription/renew').then((r) => r.data),
  getUsage: () => api.get('/v1/billing/usage').then((r) => r.data),
  getLimits: () => api.get('/v1/billing/limits').then((r) => r.data),
  getInvoices: () => api.get('/v1/billing/invoices').then((r) => r.data),
  getPaymentProviders: () => api.get('/v1/payments/providers').then((r) => r.data),
  getPaymentHistory: () => api.get('/v1/payments/history').then((r) => r.data),
  payInvoice: (invoiceId: string) => api.post(`/v1/payments/invoices/${invoiceId}/pay`, {}).then((r) => r.data),
  mockCompletePayment: (paymentId: string) => api.post(`/v1/payments/${paymentId}/mock-complete`).then((r) => r.data),
  getCommercialMetrics: () => api.get('/v1/billing/admin/metrics').then((r) => r.data),
};

export const organizationApi = {
  getCurrent: () => api.get('/v1/organizations/current').then((r) => r.data),
  getMembers: () => api.get('/v1/organizations/current/members').then((r) => r.data),
  invite: (email: string, role: string) =>
    api.post('/v1/organizations/current/members/invite', { email, role }).then((r) => r.data),
  getInvitations: () => api.get('/v1/organizations/current/invitations').then((r) => r.data),
  removeMember: (id: string) => api.delete(`/v1/organizations/current/members/${id}`).then((r) => r.data),
};

export const backupApi = {
  getStatus: () => api.get('/v1/backups/status').then((r) => r.data),
};

export const supportApi = {
  getDashboard: () => api.get('/v1/support/dashboard').then((r) => r.data),
};

export function exportUrl(domain: string, format: 'csv' | 'xlsx' | 'pdf' = 'csv') {
  return `/api/v1/exports/${domain}?format=${format}`;
}
