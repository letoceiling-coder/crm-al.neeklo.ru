import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { systemSettingsApi } from '@/lib/system-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const labels: Record<string, string> = {
  paymentConfigured: 'Payment configured (YooKassa)',
  yookassaConfigured: 'YooKassa configured',
  smtpConfigured: 'SMTP configured',
  alertEmailConfigured: 'Alert Email configured',
  registrationEnabled: 'Registration enabled',
  webhookReachable: 'Webhook reachable',
  paymentTestPassed: 'Payment test passed',
  emailTestPassed: 'Email test passed',
};

export function SystemLaunchPage() {
  const { data, isLoading } = useQuery({ queryKey: ['system-launch'], queryFn: systemSettingsApi.getLaunch });
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  const checks = data?.checks ?? {};
  const percent = data?.readinessPercent ?? 0;
  const isGo = data?.verdict === 'GO';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/system/settings/general"><ArrowLeft className="h-4 w-4 mr-2" />Настройки системы</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Launch Center</h1>
        <p className="text-muted-foreground">Готовность к публичному коммерческому запуску</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Launch Readiness
            <span className="text-3xl font-bold">{percent}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className={`rounded-lg border p-4 text-center text-lg font-semibold ${isGo ? 'border-green-500 bg-green-500/10 text-green-700' : 'border-destructive bg-destructive/10 text-destructive'}`}>
            {isGo ? 'GO — PUBLIC COMMERCIAL LAUNCH ALLOWED' : 'NO-GO — PUBLIC COMMERCIAL LAUNCH FORBIDDEN'}
          </div>
          <ul className="space-y-2">
            {Object.entries(labels)
              .filter(([key]) => key !== 'yookassaConfigured')
              .map(([key, label]) => {
              const ok = checks[key as keyof typeof checks];
              return (
                <li key={key} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  {label}
                </li>
              );
            })}
          </ul>
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>Webhook: {data?.webhookUrl}</p>
            <p>Return URL: {data?.returnUrl}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
