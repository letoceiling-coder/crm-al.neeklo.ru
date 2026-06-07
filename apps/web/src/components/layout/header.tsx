import { Moon, Sun, Monitor, LogOut, Search, Command } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CommandPalette } from '@/components/command-palette';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  const cycleTheme = () => {
    const order = ['light', 'dark', 'system'] as const;
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Поиск...</span>
          <kbd className="ml-4 hidden sm:inline-flex items-center gap-1 rounded border border-border px-1.5 text-xs">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={cycleTheme}>
            <ThemeIcon className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {user?.name?.[0] ?? user?.email[0]?.toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium">{user?.name ?? user?.email}</div>
              <div className="text-xs text-muted-foreground">{user?.role}</div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}
