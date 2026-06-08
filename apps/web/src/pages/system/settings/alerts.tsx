import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { systemSettingsApi } from '@/lib/system-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

export function SettingsAlertsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-alerts'], queryFn: systemSettingsApi.getAlerts });
  const [form, setForm] = useState({
    alertEmail: '',
    queueAlerts: true,
    paymentAlerts: true,
    storageAlerts: true,
    smtpAlerts: true,
    securityAlerts: true,
    parserAlerts: true,
    telegramEnabled: false,
    telegramChatId: '',
    telegramBotToken: '',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (data) {
      setForm((f) => ({
        ...f,
        alertEmail: data.alertEmail ?? '',
        queueAlerts: data.queueAlerts ?? true,
        paymentAlerts: data.paymentAlerts ?? true,
        storageAlerts: data.storageAlerts ?? true,
        smtpAlerts: data.smtpAlerts ?? true,
        securityAlerts: data.securityAlerts ?? true,
        parserAlerts: data.parserAlerts ?? true,
        telegramEnabled: data.telegramEnabled ?? false,
        telegramChatId: data.telegramChatId ?? '',
        telegramBotToken: '',
      }));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      systemSettingsApi.updateAlerts({
        ...form,
        telegramBotToken: form.telegramBotToken || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-alerts'] });
      setForm((f) => ({ ...f, telegramBotToken: '' }));
      setMsg('Сохранено');
    },
  });

  const test = useMutation({
    mutationFn: () => systemSettingsApi.testAlert(),
    onSuccess: () => setMsg('Тестовое email-уведомление отправлено'),
    onError: (e: Error) => setMsg(e.message),
  });

  const testTelegram = useMutation({
    mutationFn: () => systemSettingsApi.testTelegramAlert(),
    onSuccess: (r) => setMsg(r.ok ? r.message : `Telegram: ${r.message}`),
    onError: (e: Error) => setMsg(e.message),
  });

  const toggles: Array<{ key: keyof typeof form; label: string }> = [
    { key: 'queueAlerts', label: 'Queue errors' },
    { key: 'paymentAlerts', label: 'Payment failures' },
    { key: 'smtpAlerts', label: 'SMTP failures' },
    { key: 'parserAlerts', label: 'Parser failures' },
    { key: 'securityAlerts', label: 'Security alerts' },
    { key: 'storageAlerts', label: 'Storage warnings' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Email оповещения</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Email</label>
            <Input value={form.alertEmail} onChange={(e) => setForm({ ...form, alertEmail: e.target.value })} />
          </div>
          {toggles.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              Тест email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram (дополнительно)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Необязательный канал. Launch Center не требует Telegram.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.telegramEnabled}
              onChange={(e) => setForm({ ...form, telegramEnabled: e.target.checked })}
            />
            Включить Telegram-уведомления
          </label>
          <div className="space-y-2">
            <label className="text-sm font-medium">Chat ID</label>
            <Input
              value={form.telegramChatId}
              onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
              placeholder="-1001234567890"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Bot Token {data?.hasTelegramBotToken && '(установлен)'}
            </label>
            <Input
              type="password"
              value={form.telegramBotToken}
              onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })}
              placeholder="123456:ABC..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
            <Button
              variant="outline"
              onClick={() => testTelegram.mutate()}
              disabled={testTelegram.isPending || !form.telegramEnabled}
            >
              Тест Telegram
            </Button>
          </div>
        </CardContent>
      </Card>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

export function SettingsRegistrationPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-registration'], queryFn: systemSettingsApi.getRegistration });
  const [form, setForm] = useState({
    enabled: false,
    inviteOnly: false,
    defaultPlan: 'FREE',
    requireEmailVerification: false,
    autoCreateOrganization: true,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => systemSettingsApi.updateRegistration(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-registration'] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Регистрация</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />Registration Enabled</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.inviteOnly} onChange={(e) => setForm({ ...form, inviteOnly: e.target.checked })} />Invite Only Mode</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requireEmailVerification} onChange={(e) => setForm({ ...form, requireEmailVerification: e.target.checked })} />Require Email Verification</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoCreateOrganization} onChange={(e) => setForm({ ...form, autoCreateOrganization: e.target.checked })} />Auto Create Organization</label>
        <div className="space-y-2"><label className="text-sm font-medium">Default Plan</label><Input value={form.defaultPlan} onChange={(e) => setForm({ ...form, defaultPlan: e.target.value })} /></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
      </CardContent>
    </Card>
  );
}

export function SettingsBillingPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-billing'], queryFn: systemSettingsApi.getBilling });
  const [form, setForm] = useState({
    defaultCurrency: 'RUB',
    invoicePrefix: 'INV',
    paymentTimeoutHours: 72,
    gracePeriodDays: 3,
    trialDays: 0,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => systemSettingsApi.updateBilling(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-billing'] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Биллинг</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><label className="text-sm font-medium">Default Currency</label><Input value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })} /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Invoice Prefix</label><Input value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Payment Timeout (hours)</label><Input type="number" value={form.paymentTimeoutHours} onChange={(e) => setForm({ ...form, paymentTimeoutHours: Number(e.target.value) })} /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Grace Period (days)</label><Input type="number" value={form.gracePeriodDays} onChange={(e) => setForm({ ...form, gracePeriodDays: Number(e.target.value) })} /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Trial Days</label><Input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} /></div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
      </CardContent>
    </Card>
  );
}
