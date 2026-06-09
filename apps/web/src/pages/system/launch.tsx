import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { systemSettingsApi } from '@/lib/system-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const labels: Record<string, string> = {
  paymentConfigured: 'YooKassa настроена',
  smtpConfigured: 'SMTP настроен',
  alertEmailConfigured: 'Email уведомлений настроен',
  webhookReachable: 'Webhook доступен',
  paymentTestPassed: 'Тест платежа пройден',
  emailTestPassed: 'Тест отправки почты пройден',
};

const infoLabels: Record<string, string> = {
  registrationEnabled: 'Регистрация пользователей включена',
  yookassaTestMode: 'Тестовый режим YooKassa',
  yookassaEnabled: 'YooKassa включена',
};

export function SystemLaunchPage() {
  const { data, isLoading } = useQuery({ queryKey: ['system-launch'], queryFn: systemSettingsApi.getLaunch });
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  const checks = data?.checks ?? {};
  const informational = data?.informational ?? {};
  const percent = data?.readinessPercent ?? 0;
  const isGo = data?.verdict === 'GO';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/system/settings/general"><ArrowLeft className="h-4 w-4 mr-2" />Настройки системы</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Центр запуска</h1>
        <p className="text-muted-foreground">Готовность к публичному коммерческому запуску</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Готовность к запуску
            <span className="text-3xl font-bold">{percent}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className={`rounded-lg border p-4 text-center text-lg font-semibold ${isGo ? 'border-green-500 bg-green-500/10 text-green-700' : 'border-destructive bg-destructive/10 text-destructive'}`}>
            {isGo ? 'GO — публичный коммерческий запуск разрешён' : 'NO-GO — публичный коммерческий запуск запрещён'}
          </div>
          <ul className="space-y-2">
            {Object.entries(labels).map(([key, label]) => {
              const ok = checks[key as keyof typeof checks];
              return (
                <li key={key} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  {label}
                </li>
              );
            })}
          </ul>
          {Object.keys(informational).length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Дополнительно</p>
              {Object.entries(infoLabels).map(([key, label]) => {
                const val = informational[key as keyof typeof informational];
                if (val === undefined) return null;
                return (
                  <p key={key} className="text-sm text-muted-foreground">
                    {label}: {val ? 'да' : 'нет'}
                  </p>
                );
              })}
            </div>
          )}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>Webhook: {data?.webhookUrl}</p>
            <p>Return URL: {data?.returnUrl}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
