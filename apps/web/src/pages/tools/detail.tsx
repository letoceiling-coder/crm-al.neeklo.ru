import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Wifi } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  INSTANCE_STATUS_LABELS,
  PROVIDER_TYPE_LABELS,
  type ToolInstance,
  type ToolExecutionStatus,
} from '@/lib/tools';
import { formatDate } from '@/lib/utils';

export function ToolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: instance, isLoading } = useQuery<
    ToolInstance & {
      executionLogs?: Array<{
        id: string;
        status: ToolExecutionStatus;
        latencyMs: number;
        error?: string | null;
        createdAt: string;
      }>;
    }
  >({
    queryKey: ['tool-instance', id],
    queryFn: () => api.get(`/v1/tools/instances/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post(`/v1/tools/instances/${id}/test`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-instance', id] });
      queryClient.invalidateQueries({ queryKey: ['tool-instances'] });
    },
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (!instance) {
    return (
      <Card>
        <CardContent className="pt-6 text-destructive">Инструмент не найден</CardContent>
      </Card>
    );
  }

  const def = instance.definition as ToolInstance['definition'] & {
    provider?: { name: string };
    description?: string;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tools/instances">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{instance.name}</h1>
          <p className="text-muted-foreground">
            {def.name} · {PROVIDER_TYPE_LABELS[def.providerType]}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          <Wifi className="h-4 w-4 mr-2" />
          Проверить подключение
        </Button>
      </div>

      {testMutation.data && (
        <Card className="border-primary/30">
          <CardContent className="pt-6 text-sm">
            <p>
              Результат: <Badge variant={testMutation.data.status === 'SUCCESS' ? 'success' : 'destructive'}>
                {testMutation.data.status}
              </Badge>{' '}
              · {testMutation.data.latencyMs} ms
            </p>
            {testMutation.data.error && (
              <p className="text-destructive mt-2">{testMutation.data.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Статус</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Статус:{' '}
              <Badge variant={instance.status === 'ACTIVE' ? 'success' : 'outline'}>
                {INSTANCE_STATUS_LABELS[instance.status]}
              </Badge>
            </p>
            {instance.lastTestedAt && (
              <p className="text-muted-foreground">
                Последняя проверка: {formatDate(instance.lastTestedAt)}
                {instance.lastTestStatus ? ` (${instance.lastTestStatus})` : ''}
              </p>
            )}
            <p className="text-muted-foreground">{def.description ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              Настройки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-48">
              {JSON.stringify(instance.settings, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Журнал выполнения</CardTitle>
        </CardHeader>
        <CardContent>
          {!instance.executionLogs?.length ? (
            <p className="text-sm text-muted-foreground">Запусков пока нет</p>
          ) : (
            <div className="space-y-2">
              {instance.executionLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center gap-2 text-sm border-b border-border/60 pb-2"
                >
                  <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}>
                    {log.status}
                  </Badge>
                  <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                  <span className="text-muted-foreground">{log.latencyMs} ms</span>
                  {log.error && <span className="text-destructive">{log.error}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
