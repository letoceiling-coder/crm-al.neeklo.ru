import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { telegramApi } from '@/lib/telegram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const typeOptions = [
  { value: '', label: 'Все типы' },
  { value: 'QUEUE_ERROR', label: 'Ошибки очередей' },
  { value: 'PARSER_ERROR', label: 'Ошибки парсинга' },
  { value: 'SMTP_ERROR', label: 'Ошибки SMTP' },
  { value: 'PAYMENT_ERROR', label: 'Ошибки платежей' },
  { value: 'SECURITY_ALERT', label: 'Безопасность' },
  { value: 'SYSTEM_ALERT', label: 'Система' },
  { value: 'STORAGE_WARNING', label: 'Хранилище' },
];

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'SENT', label: 'Отправлено' },
  { value: 'FAILED', label: 'Ошибка' },
];

export function TelegramHistoryPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['telegram-notifications', type, status, userId, from, to],
    queryFn: () =>
      telegramApi.listNotifications({
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>История уведомлений</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Input placeholder="ID пользователя" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" onClick={() => refetch()}>Применить фильтры</Button>
        </div>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 pr-2">Дата</th>
                <th className="pb-2 pr-2">Тип</th>
                <th className="pb-2 pr-2">Пользователь</th>
                <th className="pb-2 pr-2">Заголовок</th>
                <th className="pb-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(data as Array<{
                id: string;
                type: string;
                title: string;
                status: string;
                createdAt: string;
                user?: { firstName?: string; username?: string; telegramId: string };
              }> | undefined)?.map((n) => (
                <tr key={n.id} className="border-b border-border">
                  <td className="py-2 pr-2">{new Date(n.createdAt).toLocaleString('ru-RU')}</td>
                  <td className="py-2 pr-2">{n.type}</td>
                  <td className="py-2 pr-2">
                    {n.user?.firstName ?? n.user?.username ?? n.user?.telegramId ?? '—'}
                  </td>
                  <td className="py-2 pr-2">{n.title}</td>
                  <td className="py-2">{n.status === 'SENT' ? 'Отправлено' : 'Ошибка'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && !(data as unknown[])?.length && (
          <p className="text-muted-foreground py-4">Уведомлений пока нет.</p>
        )}
      </CardContent>
    </Card>
  );
}
