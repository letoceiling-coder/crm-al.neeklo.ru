import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  EXECUTION_STATUS_LABELS,
  STEP_TYPE_LABELS,
  type WorkflowExecution,
} from '@/lib/workflows';
import { formatDate } from '@/lib/utils';

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function WorkflowExecutionsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: executions = [], isLoading } = useQuery<WorkflowExecution[]>({
    queryKey: ['workflow-executions'],
    queryFn: () => api.get('/v1/workflows/executions/list').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/workflows">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Автоматизация
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">История выполнений</h1>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Пока нет запусков workflow.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {executions.map((ex) => {
            const open = expanded === ex.id;
            return (
              <Card key={ex.id}>
                <CardContent className="py-4">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => setExpanded(open ? null : ex.id)}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 mt-1 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-1 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{ex.workflow?.name ?? ex.id}</span>
                        <Badge
                          variant={
                            ex.status === 'COMPLETED'
                              ? 'success'
                              : ex.status === 'FAILED' || ex.status === 'DLQ'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {EXECUTION_STATUS_LABELS[ex.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span>Запуск: {ex.startedAt ? formatDate(ex.startedAt) : formatDate(ex.createdAt)}</span>
                        {ex.finishedAt && <span>Завершение: {formatDate(ex.finishedAt)}</span>}
                        <span>Длительность: {formatDuration(ex.durationMs)}</span>
                      </div>
                      {ex.error && (
                        <p className="mt-2 text-sm text-destructive truncate">{ex.error}</p>
                      )}
                    </div>
                  </button>

                  {open && ex.logs && ex.logs.length > 0 && (
                    <div className="mt-4 ml-7 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[640px] text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground text-left">
                            <th className="px-3 py-2">Шаг</th>
                            <th className="px-3 py-2">Статус</th>
                            <th className="px-3 py-2">Время</th>
                            <th className="px-3 py-2">Ошибка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ex.logs.map((log) => (
                            <tr key={log.id} className="border-b border-border/60 align-top">
                              <td className="px-3 py-2">
                                <div className="font-medium">{log.step?.stepKey ?? '—'}</div>
                                <div className="text-muted-foreground">
                                  {log.step?.stepType ? STEP_TYPE_LABELS[log.step.stepType] : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2">{log.status}</td>
                              <td className="px-3 py-2">{log.latencyMs} ms</td>
                              <td className="px-3 py-2 text-destructive max-w-[200px] truncate">
                                {log.error ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ex.logs.map((log) => (
                        <details key={`${log.id}-io`} className="border-t px-3 py-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            {log.step?.stepKey}: вход / выход
                          </summary>
                          <pre className="mt-2 overflow-auto rounded bg-muted p-2 max-h-40">
                            {JSON.stringify({ input: log.input, output: log.output }, null, 2)}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
