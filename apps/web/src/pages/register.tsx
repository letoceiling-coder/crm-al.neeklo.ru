import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    api.get('/auth/registration-status').then((r) => setEnabled(r.data.enabled)).catch(() => setEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', { email, password, organizationName, name: name || undefined });
      setAuth(data.accessToken, data.user);
      applyTheme();
      navigate('/onboarding');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) return null;

  if (!enabled) {
    return (
      <div className="gradient-bg flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Регистрация недоступна</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Публичная регистрация отключена. Обратитесь к администратору.</p>
            <Link to="/login"><Button variant="outline">Войти</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5" /><CardTitle>Регистрация</CardTitle></div>
          <CardDescription>Создайте организацию и начните с тарифа Free</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Пароль</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <div><Label>Название организации</Label><Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required /></div>
            <div><Label>Имя (необязательно)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Зарегистрироваться'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Уже есть аккаунт? <Link to="/login" className="text-primary underline">Войти</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
