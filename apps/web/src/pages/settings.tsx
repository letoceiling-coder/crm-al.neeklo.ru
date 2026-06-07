import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Moon, Sun, Monitor, Shield, Key, LayoutTemplate } from 'lucide-react';
import { api } from '@/lib/api';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [twoFaCode, setTwoFaCode] = useState('');
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string } | null>(null);

  const changePassword = useMutation({
    mutationFn: () => api.put('/auth/password', passwords),
  });

  const setup2Fa = useMutation({
    mutationFn: () => api.post('/auth/2fa/setup'),
    onSuccess: (res) => setQrData(res.data),
  });

  const enable2Fa = useMutation({
    mutationFn: () => api.post('/auth/2fa/enable', { code: twoFaCode }),
  });

  const themes = [
    { value: 'light' as const, label: 'Светлая', icon: Sun },
    { value: 'dark' as const, label: 'Тёмная', icon: Moon },
    { value: 'system' as const, label: 'Системная', icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">Профиль и параметры аккаунта</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Шаблоны ассистентов
          </CardTitle>
          <CardDescription>Каталог готовых шаблонов для создания AI ассистентов</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/settings/assistant-templates">Открыть каталог шаблонов</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Роль</span>
            <span>{user?.role}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Тема оформления</CardTitle>
          <CardDescription>Настройка сохраняется в профиле</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                  theme === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Смена пароля
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Текущий пароль</Label>
            <Input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Новый пароль</Label>
            <Input type="password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
          </div>
          <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
            {changePassword.isSuccess ? 'Сохранено!' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Двухфакторная аутентификация
          </CardTitle>
          <CardDescription>
            {user?.twoFaEnabled ? '2FA включена' : 'Дополнительная защита аккаунта'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user?.twoFaEnabled && !qrData && (
            <Button onClick={() => setup2Fa.mutate()}>Настроить 2FA</Button>
          )}
          {qrData && (
            <>
              <img src={qrData.qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
              <div className="space-y-2">
                <Label>Код из приложения</Label>
                <Input value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} placeholder="000000" />
              </div>
              <Button onClick={() => enable2Fa.mutate()}>Включить 2FA</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
