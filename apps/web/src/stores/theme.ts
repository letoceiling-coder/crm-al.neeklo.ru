import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { useAuthStore } from './auth';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  applyTheme: () => void;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: async (theme) => {
        set({ theme });
        get().applyTheme();
        const user = useAuthStore.getState().user;
        if (user) {
          const themeMap = { light: 'LIGHT', dark: 'DARK', system: 'SYSTEM' } as const;
          try {
            await api.put('/auth/theme', { theme: themeMap[theme] });
          } catch {
            /* ignore */
          }
        }
      },
      applyTheme: () => {
        const resolved = resolveTheme(get().theme);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
      },
    }),
    { name: 'ai-gateway-theme' },
  ),
);
