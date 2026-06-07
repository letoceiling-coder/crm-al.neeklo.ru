import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ApiKeysPage } from '@/pages/api-keys';
import { ModelsPage } from '@/pages/models';
import { KeyModelProfilesPage } from '@/pages/key-model-profiles';
import { AgentsPage } from '@/pages/agents';
import { AnalyticsPage } from '@/pages/analytics';
import { DocsPage } from '@/pages/docs';
import { SettingsPage } from '@/pages/settings';
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminAuditPage,
} from '@/pages/admin';
import { AdminPricingPage } from '@/pages/admin/pricing';
import { AdminUsagePage } from '@/pages/admin/usage';
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
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="keys" element={<ApiKeysPage />} />
            <Route path="key-models" element={<KeyModelProfilesPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<ProtectedAdmin><AdminDashboardPage /></ProtectedAdmin>} />
            <Route path="admin/users" element={<ProtectedAdmin><AdminUsersPage /></ProtectedAdmin>} />
            <Route path="admin/pricing" element={<ProtectedAdmin><AdminPricingPage /></ProtectedAdmin>} />
            <Route path="admin/usage" element={<ProtectedAdmin><AdminUsagePage /></ProtectedAdmin>} />
            <Route path="admin/audit" element={<ProtectedAdmin><AdminAuditPage /></ProtectedAdmin>} />
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
