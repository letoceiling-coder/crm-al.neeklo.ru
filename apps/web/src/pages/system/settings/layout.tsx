import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const nav = [
  { to: '/system/settings/general', label: 'Общие' },
  { to: '/system/settings/payments', label: 'Платежи' },
  { to: '/system/settings/email', label: 'Почта' },
  { to: '/system/settings/alerts', label: 'Оповещения' },
  { to: '/system/settings/registration', label: 'Регистрация' },
  { to: '/system/settings/billing', label: 'Биллинг' },
  { to: '/system/settings/security', label: 'Безопасность' },
  { to: '/system/settings/storage', label: 'Хранилище' },
  { to: '/system/settings/monitoring', label: 'Мониторинг' },
];

export function SystemSettingsLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/system">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Система
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Настройки системы</h1>
        <p className="text-muted-foreground">Launch-критичные параметры платформы — только ADMIN</p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex lg:w-56 shrink-0 flex-row flex-wrap gap-1 lg:flex-col">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'rounded-lg px-3 py-2 text-sm transition-colors',
                location.pathname === item.to
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/system/launch"
            className={cn(
              'rounded-lg px-3 py-2 text-sm transition-colors mt-2 border border-dashed',
              location.pathname === '/system/launch'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Launch Center
          </Link>
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
