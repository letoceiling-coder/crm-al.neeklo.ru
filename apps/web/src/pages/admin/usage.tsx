import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AnalyticsPage } from '@/pages/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

export function AdminUsagePage() {
  const [apiKeyId, setApiKeyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data),
  });

  const { data: topUpStats } = useQuery({
    queryKey: ['top-up-stats-admin', apiKeyId, from, to],
    queryFn: () =>
      api
        .get('/api-keys/top-ups/stats', {
          params: {
            apiKeyId: apiKeyId || undefined,
            from: from || undefined,
            to: to || undefined,
          },
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground">
          Статистика платформы: расходы, себестоимость, маржа и начисления на ключи
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Начисления на баланс ключей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>API ключ</Label>
              <select
                className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                value={apiKeyId}
                onChange={(e) => setApiKeyId(e.target.value)}
              >
                <option value="">Все ключи</option>
                {(keys ?? []).map((k: { id: string; name: string }) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>С даты</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>По дату</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Всего начислено</div>
              <div className="text-2xl font-bold">
                {formatCurrency(topUpStats?.totalTopUpRub ?? 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                операций: {topUpStats?.topUpCount ?? 0}
              </div>
            </div>
          </div>
          {(topUpStats?.byApiKey?.length ?? 0) > 0 && (
            <table className="w-full text-sm mt-4">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Ключ</th>
                  <th className="pb-2 font-medium">Сумма</th>
                  <th className="pb-2 font-medium">Операций</th>
                </tr>
              </thead>
              <tbody>
                {topUpStats.byApiKey.map(
                  (row: {
                    apiKeyId: string;
                    name?: string;
                    keyPrefix?: string;
                    totalRub: number;
                    count: number;
                  }) => (
                    <tr key={row.apiKeyId} className="border-b border-border/50">
                      <td className="py-2">
                        {row.name ?? row.keyPrefix ?? row.apiKeyId}
                      </td>
                      <td className="py-2">{formatCurrency(row.totalRub)}</td>
                      <td className="py-2">{row.count}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AnalyticsPage embedded />
    </div>
  );
}
