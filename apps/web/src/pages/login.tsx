import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [requires2Fa, setRequires2Fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        twoFaCode: requires2Fa ? twoFaCode : undefined,
      });

      if (data.requires2Fa) {
        setRequires2Fa(true);
        return;
      }

      setAuth(data.accessToken, data.user);
      applyTheme();
      navigate('/');
    } catch {
      setError('Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">AI Gateway</h1>
          <p className="text-muted-foreground mt-1">Платформа управления AI-доступом</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход в систему</CardTitle>
            <CardDescription>Доступ только для авторизованных пользователей</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ai-gateway.local"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {requires2Fa && (
                <div className="space-y-2">
                  <Label htmlFor="2fa">Код 2FA</Label>
                  <Input
                    id="2fa"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {requires2Fa ? 'Подтвердить' : 'Войти'}
              </Button>
              <p className="text-center text-sm text-muted-foreground pt-2">
                Нет аккаунта? <a href="/register" className="text-primary underline">Регистрация</a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
