import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ApiKeysPage } from '@/pages/api-keys';
import { ModelsPage } from '@/pages/models';
import { KeyModelProfilesPage } from '@/pages/key-model-profiles';
import { AgentsPage } from '@/pages/agents';
import { AssistantsListPage } from '@/pages/assistants';
import { AssistantsCreatePage } from '@/pages/assistants/create';
import { AssistantDetailPage } from '@/pages/assistants/detail';
import { KnowledgeListPage } from '@/pages/knowledge';
import { KnowledgeCreatePage } from '@/pages/knowledge/create';
import { KnowledgeDetailPage } from '@/pages/knowledge/detail';
import { KnowledgeJobsPage } from '@/pages/knowledge/jobs';
import { ToolsLandingPage } from '@/pages/tools';
import { ToolsCatalogPage } from '@/pages/tools/catalog';
import { ToolsInstancesPage } from '@/pages/tools/instances';
import { ToolDetailPage } from '@/pages/tools/detail';
import { CrmOverviewPage } from '@/pages/crm';
import { CrmLeadsPage } from '@/pages/crm/leads';
import { CrmClientsPage } from '@/pages/crm/clients';
import { CrmClientDetailPage } from '@/pages/crm/client-detail';
import { CrmDealsPage } from '@/pages/crm/deals';
import { CrmTasksPage } from '@/pages/crm/tasks';
import { WorkflowsListPage } from '@/pages/workflows';
import { WorkflowsCreatePage } from '@/pages/workflows/create';
import { WorkflowDetailPage } from '@/pages/workflows/detail';
import { WorkflowExecutionsPage } from '@/pages/workflows/executions';
import { WorkflowTemplatesPage } from '@/pages/workflows/templates';
import { MemoryOverviewPage } from '@/pages/memory';
import { MemoryProfilesPage } from '@/pages/memory/profiles';
import { MemoryProfileDetailPage } from '@/pages/memory/profile-detail';
import { MemorySearchPage } from '@/pages/memory/search';
import { IntegrationsOverviewPage } from '@/pages/integrations';
import { IntegrationProviderPage } from '@/pages/integrations/provider';
import { IntegrationAccountDetailPage } from '@/pages/integrations/account-detail';
import { MessagesInboxPage } from '@/pages/messages';
import { MessageDetailPage } from '@/pages/messages/detail';
import { MarketplacePage } from '@/pages/marketplace';
import { MarketplacePackageDetailPage } from '@/pages/marketplace/detail';
import { MarketplacePublishPage } from '@/pages/marketplace/publish';
import { MarketplaceMyPage } from '@/pages/marketplace/my';
import { MarketplaceInstalledPage } from '@/pages/marketplace/installed';
import { AnalyticsPage } from '@/pages/analytics';
import { DocsPage } from '@/pages/docs';
import { SettingsPage } from '@/pages/settings';
import { AssistantTemplatesPage } from '@/pages/settings/assistant-templates';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminAuditPage,
} from '@/pages/admin';
import { AdminPricingPage } from '@/pages/admin/pricing';
import { AdminUsagePage } from '@/pages/admin/usage';
import { SystemOverviewPage } from '@/pages/system';
import {
  SystemMetricsPage,
  SystemQueuesPage,
  SystemHealthPage,
  SystemDependenciesPage,
  SystemSecurityPage,
} from '@/pages/system/pages';
import {
  SystemSettingsLayout,
  SettingsGeneralPage,
  SettingsPaymentsPage,
  SettingsEmailPage,
  SettingsAlertsPage,
  SettingsRegistrationPage,
  SettingsBillingPage,
  SettingsSecurityPage,
  SettingsStoragePage,
  SettingsMonitoringPage,
} from '@/pages/system/settings';
import { SystemLaunchPage } from '@/pages/system/launch';
import { BillingOverviewPage } from '@/pages/billing';
import { BillingSubscriptionPage, BillingUsagePage, BillingInvoicesPage, BillingPaymentMethodsPage, BillingHistoryPage } from '@/pages/billing/pages';
import { RegisterPage } from '@/pages/register';
import { OnboardingPage } from '@/pages/onboarding';
import { OrganizationOverviewPage } from '@/pages/organization';
import { OrganizationMembersPage, OrganizationInvitationsPage } from '@/pages/organization/pages';
import { LegalIndexPage, LegalDocumentPage, BackupsPage, SupportDashboardPage } from '@/pages/legal';
import { useAuthStore } from '@/stores/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<AppLayout />}>
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route index element={<DashboardPage />} />
            <Route path="keys" element={<ApiKeysPage />} />
            <Route path="key-models" element={<KeyModelProfilesPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="agents" element={<ProtectedAdmin><AgentsPage /></ProtectedAdmin>} />
            <Route path="assistants" element={<AssistantsListPage />} />
            <Route path="assistants/create" element={<AssistantsCreatePage />} />
            <Route path="assistants/:id" element={<AssistantDetailPage />} />
            <Route path="knowledge" element={<KnowledgeListPage />} />
            <Route path="knowledge/jobs" element={<KnowledgeJobsPage />} />
            <Route path="knowledge/create" element={<KnowledgeCreatePage />} />
            <Route path="knowledge/:id" element={<KnowledgeDetailPage />} />
            <Route path="tools" element={<ToolsLandingPage />} />
            <Route path="tools/catalog" element={<ToolsCatalogPage />} />
            <Route path="tools/instances" element={<ToolsInstancesPage />} />
            <Route path="tools/:id" element={<ToolDetailPage />} />
            <Route path="crm" element={<CrmOverviewPage />} />
            <Route path="crm/leads" element={<CrmLeadsPage />} />
            <Route path="crm/clients" element={<CrmClientsPage />} />
            <Route path="crm/clients/:id" element={<CrmClientDetailPage />} />
            <Route path="crm/deals" element={<CrmDealsPage />} />
            <Route path="crm/tasks" element={<CrmTasksPage />} />
            <Route path="workflows" element={<WorkflowsListPage />} />
            <Route path="workflows/create" element={<WorkflowsCreatePage />} />
            <Route path="workflows/templates" element={<WorkflowTemplatesPage />} />
            <Route path="workflows/executions" element={<WorkflowExecutionsPage />} />
            <Route path="workflows/:id" element={<WorkflowDetailPage />} />
            <Route path="memory" element={<MemoryOverviewPage />} />
            <Route path="memory/profiles" element={<MemoryProfilesPage />} />
            <Route path="memory/profiles/:id" element={<MemoryProfileDetailPage />} />
            <Route path="memory/search" element={<MemorySearchPage />} />
            <Route path="integrations" element={<IntegrationsOverviewPage />} />
            <Route path="integrations/accounts/:id" element={<IntegrationAccountDetailPage />} />
            <Route path="integrations/:provider" element={<IntegrationProviderPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="marketplace/package/:id" element={<MarketplacePackageDetailPage />} />
            <Route path="marketplace/publish" element={<MarketplacePublishPage />} />
            <Route path="marketplace/my" element={<MarketplaceMyPage />} />
            <Route path="marketplace/installed" element={<MarketplaceInstalledPage />} />
            <Route path="messages" element={<MessagesInboxPage />} />
            <Route path="messages/:id" element={<MessageDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/assistant-templates" element={<AssistantTemplatesPage />} />
            <Route path="billing" element={<BillingOverviewPage />} />
            <Route path="billing/subscription" element={<BillingSubscriptionPage />} />
            <Route path="billing/usage" element={<BillingUsagePage />} />
            <Route path="billing/invoices" element={<BillingInvoicesPage />} />
            <Route path="billing/payment-methods" element={<BillingPaymentMethodsPage />} />
            <Route path="billing/history" element={<BillingHistoryPage />} />
            <Route path="organization" element={<OrganizationOverviewPage />} />
            <Route path="organization/members" element={<OrganizationMembersPage />} />
            <Route path="organization/invitations" element={<OrganizationInvitationsPage />} />
            <Route path="backups" element={<BackupsPage />} />
            <Route path="legal" element={<LegalIndexPage />} />
            <Route path="legal/terms" element={<LegalDocumentPage slug="terms" />} />
            <Route path="legal/privacy" element={<LegalDocumentPage slug="privacy" />} />
            <Route path="legal/cookies" element={<LegalDocumentPage slug="cookies" />} />
            <Route path="legal/dpa" element={<LegalDocumentPage slug="dpa" />} />
            <Route path="legal/marketplace-publisher" element={<LegalDocumentPage slug="marketplace-publisher" />} />
            <Route path="admin" element={<ProtectedAdmin><AdminDashboardPage /></ProtectedAdmin>} />
            <Route path="admin/users" element={<ProtectedAdmin><AdminUsersPage /></ProtectedAdmin>} />
            <Route path="admin/pricing" element={<ProtectedAdmin><AdminPricingPage /></ProtectedAdmin>} />
            <Route path="admin/usage" element={<ProtectedAdmin><AdminUsagePage /></ProtectedAdmin>} />
            <Route path="admin/audit" element={<ProtectedAdmin><AdminAuditPage /></ProtectedAdmin>} />
            <Route path="system" element={<ProtectedAdmin><SystemOverviewPage /></ProtectedAdmin>} />
            <Route path="system/metrics" element={<ProtectedAdmin><SystemMetricsPage /></ProtectedAdmin>} />
            <Route path="system/queues" element={<ProtectedAdmin><SystemQueuesPage /></ProtectedAdmin>} />
            <Route path="system/health" element={<ProtectedAdmin><SystemHealthPage /></ProtectedAdmin>} />
            <Route path="system/dependencies" element={<ProtectedAdmin><SystemDependenciesPage /></ProtectedAdmin>} />
            <Route path="system/security" element={<ProtectedAdmin><SystemSecurityPage /></ProtectedAdmin>} />
            <Route path="system/launch" element={<ProtectedAdmin><SystemLaunchPage /></ProtectedAdmin>} />
            <Route path="system/settings" element={<ProtectedAdmin><SystemSettingsLayout /></ProtectedAdmin>}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<SettingsGeneralPage />} />
              <Route path="payments" element={<SettingsPaymentsPage />} />
              <Route path="email" element={<SettingsEmailPage />} />
              <Route path="alerts" element={<SettingsAlertsPage />} />
              <Route path="registration" element={<SettingsRegistrationPage />} />
              <Route path="billing" element={<SettingsBillingPage />} />
              <Route path="security" element={<SettingsSecurityPage />} />
              <Route path="storage" element={<SettingsStoragePage />} />
              <Route path="monitoring" element={<SettingsMonitoringPage />} />
            </Route>
            <Route path="admin/support" element={<ProtectedAdmin><SupportDashboardPage /></ProtectedAdmin>} />
            <Route path="admin/commercial" element={<ProtectedAdmin><AdminDashboardPage /></ProtectedAdmin>} />
            <Route path="admin/keys" element={<Navigate to="/admin" replace />} />
            <Route path="admin/agents" element={<Navigate to="/admin" replace />} />
            <Route path="admin/models" element={<Navigate to="/admin" replace />} />
            <Route path="admin/providers" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
