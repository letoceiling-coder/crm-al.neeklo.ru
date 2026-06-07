import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Badge } from '@/components/ui/input';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export function AnalyticsPage({ embedded = false }: { embedded?: boolean }) {
  const isAdmin = useAuthStore((s) => s.isAdmin()) || embedded;
  const [apiKeyId, setApiKeyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data),
  });

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview', apiKeyId],
    queryFn: () =>
      api.get('/analytics/overview', { params: { apiKeyId: apiKeyId || undefined } }).then((r) => r.data),
  });

  const { data: daily } = useQuery({
    queryKey: ['analytics-daily', apiKeyId],
    queryFn: () =>
      api.get('/analytics/daily', { params: { apiKeyId: apiKeyId || undefined } }).then((r) => r.data),
  });

  const { data: logs } = useQuery({
    queryKey: ['analytics-logs', apiKeyId, from, to, page],
    queryFn: () =>
      api.get('/analytics/logs', {
        params: {
          apiKeyId: apiKeyId || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit,
        },
      }).then((r) => r.data),
  });

  const totalPages = logs?.meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Полная статистика: расходы клиентов и реальная себестоимость'
              : 'Статистика по вашим ключам согласно настроенным тарифам'}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>API ключ</Label>
              <select
                className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                value={apiKeyId}
                onChange={(e) => {
                  setApiKeyId(e.target.value);
                  setPage(1);
                }}
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
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-2">
              <Label>По дату</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setApiKeyId('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              {isAdmin ? 'Расход клиентов' : 'Ваш расход'}
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(overview?.balance?.totalCost ?? 0)}
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Себестоимость (реальная)</div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(overview?.balance?.realCost ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Маржа</div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(overview?.balance?.margin ?? 0)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Токенов</div>
            <div className="text-2xl font-bold mt-1">
              {formatNumber(overview?.tokens?.total ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              in: {formatNumber(overview?.tokens?.input ?? 0)} / out:{' '}
              {formatNumber(overview?.tokens?.output ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Динамика расходов</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                name={isAdmin ? 'Расход клиента' : 'Расход'}
              />
              {isAdmin && (
                <Line
                  type="monotone"
                  dataKey="realCost"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={2}
                  dot={false}
                  name="Себестоимость"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Журнал запросов
            {logs?.meta?.total != null && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({logs.meta.total} записей)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-3 font-medium">Дата</th>
                  <th className="pb-3 pr-3 font-medium">Ключ</th>
                  <th className="pb-3 pr-3 font-medium">Модель</th>
                  <th className="pb-3 pr-3 font-medium">In</th>
                  <th className="pb-3 pr-3 font-medium">Out</th>
                  <th className="pb-3 pr-3 font-medium">Расход</th>
                  {isAdmin && <th className="pb-3 pr-3 font-medium">Себест.</th>}
                  <th className="pb-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(logs?.data ?? []).map(
                  (log: {
                    id: string;
                    createdAt: string;
                    modelUsed: string;
                    inputTokens: number;
                    outputTokens: number;
                    userCost: number;
                    realCost?: number;
                    status: string;
                    fallbackUsed?: boolean;
                    apiKey?: { name: string; keyPrefix: string };
                    agent?: { name: string };
                    model?: { name: string };
                  }) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {log.apiKey?.name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs max-w-[140px] truncate">
                        {log.model?.name ?? log.modelUsed}
                        {log.agent && (
                          <span className="block text-muted-foreground">
                            agent: {log.agent.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{formatNumber(log.inputTokens)}</td>
                      <td className="py-2.5 pr-3">{formatNumber(log.outputTokens)}</td>
                      <td className="py-2.5 pr-3">{formatCurrency(log.userCost)}</td>
                      {isAdmin && (
                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {log.realCost != null ? formatCurrency(log.realCost) : '—'}
                        </td>
                      )}
                      <td className="py-2.5">
                        <Badge
                          variant={
                            log.status === 'SUCCESS'
                              ? 'success'
                              : log.status === 'FALLBACK'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {log.fallbackUsed ? 'FALLBACK' : log.status}
                        </Badge>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {!logs?.data?.length && (
              <p className="text-center text-muted-foreground py-8">Нет запросов</p>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Стр. {page} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Далее
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!embedded && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">API для интеграции</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2 font-mono">
            <p>POST /api/v1/chat/completions — Bearer API_KEY</p>
            <p>POST /api/v1/agents/:id/chat — Bearer API_KEY</p>
            <p>GET /api/v1/agents — список агентов</p>
            <p>GET /api/v1/usage — статистика по ключу</p>
            <p>GET /api/v1/usage/logs?page=1&limit=20 — журнал с пагинацией</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
