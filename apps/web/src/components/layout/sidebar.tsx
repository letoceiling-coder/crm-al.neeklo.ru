import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Key,
  Bot,
  Cpu,
  BarChart3,
  Layers,
  BookOpen,
  Settings,
  Users,
  Shield,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageSquare,
  BookMarked,
  ListTodo,
  Wrench,
  Building2,
  Workflow,
  Brain,
  Plug,
  Inbox,
  Store,
  Server,
  CreditCard,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useState } from 'react';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/keys', icon: Key, label: 'API Ключи' },
  { to: '/key-models', icon: Layers, label: 'Модели для ключей' },
  { to: '/models', icon: Cpu, label: 'Каталог OpenRouter' },
  { to: '/assistants', icon: MessageSquare, label: 'AI Ассистенты' },
  { to: '/knowledge', icon: BookMarked, label: 'Базы знаний' },
  { to: '/knowledge/jobs', icon: ListTodo, label: 'Задачи обработки' },
  { to: '/tools', icon: Wrench, label: 'Инструменты' },
  { to: '/crm', icon: Building2, label: 'CRM' },
  { to: '/workflows', icon: Workflow, label: 'Автоматизация' },
  { to: '/memory', icon: Brain, label: 'Память' },
  { to: '/integrations', icon: Plug, label: 'Интеграции' },
  { to: '/marketplace', icon: Store, label: 'Marketplace' },
  { to: '/billing', icon: CreditCard, label: 'Биллинг' },
  { to: '/organization', icon: Building2, label: 'Организация' },
  { to: '/messages', icon: Inbox, label: 'Сообщения' },
  { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
  { to: '/docs', icon: BookOpen, label: 'Документация' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

const adminNav = [
  { to: '/admin', icon: Shield, label: 'Admin Dashboard' },
  { to: '/system', icon: Server, label: 'Система' },
  { to: '/system/settings/general', icon: Settings, label: 'Настройки системы' },
  { to: '/system/launch', icon: Rocket, label: 'Центр запуска' },
  { to: '/system/telegram/settings', icon: Rocket, label: 'Telegram' },
  { to: '/agents', icon: Bot, label: 'Глобальные агенты' },
  { to: '/admin/users', icon: Users, label: 'Пользователи' },
  { to: '/admin/pricing', icon: DollarSign, label: 'Тарифы' },
  { to: '/admin/usage', icon: BarChart3, label: 'Usage' },
  { to: '/admin/audit', icon: FileText, label: 'Audit Logs' },
  { to: '/backups', icon: Server, label: 'Резервные копии' },
  { to: '/admin/support', icon: Shield, label: 'Support' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = useAuthStore((s) => s.isAdmin());

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-semibold text-sm">AI Gateway</div>
            <div className="text-xs text-muted-foreground">Platform</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {mainNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </div>
            )}
            {adminNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-12 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
