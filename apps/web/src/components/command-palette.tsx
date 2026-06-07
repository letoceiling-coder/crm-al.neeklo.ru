import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  Key,
  Bot,
  Cpu,
  BarChart3,
  Settings,
  Users,
  Shield,
} from 'lucide-react';

const pages = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/keys', label: 'API Ключи', icon: Key },
  { to: '/models', label: 'Модели', icon: Cpu },
  { to: '/agents', label: 'Агенты', icon: Bot },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/admin', label: 'Admin Dashboard', icon: Shield },
  { to: '/admin/users', label: 'Users', icon: Users },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
        <Command className="glass rounded-xl shadow-2xl overflow-hidden">
          <Command.Input
            placeholder="Поиск страниц..."
            className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </Command.Empty>
            <Command.Group heading="Страницы" className="text-xs text-muted-foreground px-2 py-1">
              {pages.map(({ to, label, icon: Icon }) => (
                <Command.Item
                  key={to}
                  onSelect={() => {
                    navigate(to);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
