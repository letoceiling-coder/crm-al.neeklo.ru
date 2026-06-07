import { useQuery } from '@tanstack/react-query';
import { Wallet, TrendingUp, Calendar, ArrowDownToLine, ArrowUpFromLine, Hash, Key } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { StatCard, formatCurrency, formatNumber } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });

  const { data: keyStats } = useQuery({
    queryKey: ['key-stats'],
    queryFn: () => api.get('/api-keys/stats').then((r) => r.data),
  });

  const { data: daily } = useQuery({
    queryKey: ['daily-usage'],
    queryFn: () => api.get('/analytics/daily').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Обзор использования AI Gateway</p>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard
          title="Общий расход"
          value={formatCurrency(data?.balance?.totalCost ?? 0)}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          title="Текущий месяц"
          value={formatCurrency(data?.balance?.monthCost ?? 0)}
          icon={Calendar}
          loading={isLoading}
        />
        <StatCard
          title="Сегодня"
          value={formatCurrency(data?.balance?.todayCost ?? 0)}
          icon={TrendingUp}
          loading={isLoading}
        />
        {isAdmin && (
          <StatCard
            title="Маржа"
            value={formatCurrency(data?.balance?.margin ?? 0)}
            icon={TrendingUp}
            loading={isLoading}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Входящие токены"
          value={formatNumber(data?.tokens?.input ?? 0)}
          icon={ArrowDownToLine}
          loading={isLoading}
        />
        <StatCard
          title="Исходящие токены"
          value={formatNumber(data?.tokens?.output ?? 0)}
          icon={ArrowUpFromLine}
          loading={isLoading}
        />
        <StatCard
          title="Всего токенов"
          value={formatNumber(data?.tokens?.total ?? 0)}
          icon={Hash}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Расход по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Расход']}
                />
                <Bar dataKey="cost" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Топ моделей</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.topModels ?? []).map((model: { model: string; requests: number; cost: number; tokens: number }, i: number) => (
                <div key={model.model} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium truncate max-w-[200px]">{model.model}</div>
                      <div className="text-xs text-muted-foreground">{model.requests} запросов</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatCurrency(model.cost)}</div>
                    <div className="text-xs text-muted-foreground">{formatNumber(model.tokens)} tok</div>
                  </div>
                </div>
              ))}
              {!isLoading && !data?.topModels?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Ключи
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-4 text-center">
              <div className="text-2xl font-bold text-success">{keyStats?.active ?? 0}</div>
              <div className="text-sm text-muted-foreground">Активные</div>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{keyStats?.blocked ?? 0}</div>
              <div className="text-sm text-muted-foreground">Заблокированные</div>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <div className="text-2xl font-bold text-warning">{keyStats?.limitExceeded ?? 0}</div>
              <div className="text-sm text-muted-foreground">Баланс исчерпан</div>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <div className="text-2xl font-bold">{keyStats?.total ?? 0}</div>
              <div className="text-sm text-muted-foreground">Всего</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
