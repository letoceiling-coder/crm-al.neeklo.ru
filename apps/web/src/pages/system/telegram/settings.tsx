import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telegramApi } from '@/lib/telegram';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export function TelegramSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['telegram-settings'], queryFn: telegramApi.getSettings });
  const [botToken, setBotToken] = useState('');
  const [msg, setMsg] = useState('');

  const save = useMutation({
    mutationFn: () => telegramApi.updateSettings({ botToken: botToken || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['telegram-settings'] });
      setBotToken('');
      setMsg(r.ok === false ? r.message : 'Сохранено. Webhook зарегистрирован.');
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const test = useMutation({
    mutationFn: () => telegramApi.testConnection(),
    onSuccess: (r) => setMsg(r.ok ? r.message : `Ошибка: ${r.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Настройки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Bot Token {data?.hasBotToken && '(установлен)'}
          </label>
          <Input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABC..."
          />
        </div>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Webhook URL: </span>
            <code className="text-xs break-all">{data?.webhookUrl}</code>
          </p>
          <p>
            <span className="text-muted-foreground">Статус подключения: </span>
            {data?.connected ? (
              <span className="text-green-600">Подключено</span>
            ) : data?.hasBotToken ? (
              <span className="text-amber-600">Требуется регистрация webhook</span>
            ) : (
              <span className="text-muted-foreground">Не настроено</span>
            )}
          </p>
          {data?.webhookRegisteredAt && (
            <p className="text-xs text-muted-foreground">
              Webhook зарегистрирован: {new Date(data.webhookRegisteredAt).toLocaleString('ru-RU')}
            </p>
          )}
          {data?.lastWebhookError && (
            <p className="text-xs text-destructive">Ошибка webhook: {data.lastWebhookError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Одобрено пользователей: {data?.approvedUsers ?? 0}, ожидают: {data?.pendingUsers ?? 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Сохранить
          </Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
            Проверить подключение
          </Button>
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
