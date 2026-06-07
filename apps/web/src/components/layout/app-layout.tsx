import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

export function AppLayout() {
  const token = useAuthStore((s) => s.token);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="gradient-bg min-h-screen">
      <Sidebar />
      <div className="pl-64 transition-all duration-300">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
