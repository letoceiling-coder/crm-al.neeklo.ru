import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from './empty-state';
import {
  INSTANCE_STATUS_LABELS,
  PROVIDER_TYPE_LABELS,
  type AssistantToolBinding,
  type ToolInstance,
} from '@/lib/tools';
import { formatDate } from '@/lib/utils';

interface Props {
  assistantId: string;
}

export function AssistantToolsTab({ assistantId }: Props) {
  const queryClient = useQueryClient();
  const [instanceId, setInstanceId] = useState('');

  const { data: bindings = [], isLoading } = useQuery<AssistantToolBinding[]>({
    queryKey: ['assistant-tool-bindings', assistantId],
    queryFn: () => api.get(`/v1/assistants/${assistantId}/tool-bindings`).then((r) => r.data),
  });

  const { data: instances = [] } = useQuery<ToolInstance[]>({
    queryKey: ['tool-instances'],
    queryFn: () => api.get('/v1/tools/instances').then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/assistants/${assistantId}/tool-bindings`, {
        toolInstanceId: instanceId,
        priority: bindings.length,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-tool-bindings', assistantId] });
      setInstanceId('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ bindingId, enabled }: { bindingId: string; enabled: boolean }) =>
      api.patch(`/v1/assistants/${assistantId}/tool-bindings/${bindingId}`, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assistant-tool-bindings', assistantId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (bindingId: string) =>
      api.delete(`/v1/assistants/${assistantId}/tool-bindings/${bindingId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assistant-tool-bindings', assistantId] }),
  });

  const available = instances.filter(
    (i) => !bindings.some((b) => b.toolInstanceId === i.id),
  );

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Подключить инструмент</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <select
            className="flex h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background/50 px-3 text-sm"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
          >
            <option value="">Выберите экземпляр</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.definition.name})
              </option>
            ))}
          </select>
          <Button disabled={!instanceId || addMutation.isPending} onClick={() => addMutation.mutate()}>
            Подключить
          </Button>
        </CardContent>
      </Card>

      {bindings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={Wrench}
              title="Инструменты не подключены"
              description="Создайте экземпляр в разделе «Инструменты» и привяжите его к ассистенту"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Инструмент</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Приоритет</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Последний запуск</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bindings.map((b) => {
                const inst = b.toolInstance;
                const last = inst.executionLogs?.[0];
                return (
                  <tr key={b.id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium">{inst.name}</td>
                    <td className="px-4 py-3">
                      {inst.definition.name} ({PROVIDER_TYPE_LABELS[inst.definition.providerType]})
                    </td>
                    <td className="px-4 py-3">{b.priority}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.enabled ? 'success' : 'outline'}>
                        {b.enabled ? 'Активен' : 'Отключён'}
                      </Badge>
                      {' · '}
                      <Badge variant={inst.status === 'ACTIVE' ? 'success' : 'outline'}>
                        {INSTANCE_STATUS_LABELS[inst.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {last ? `${last.status} · ${formatDate(last.createdAt)}` : '—'}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleMutation.mutate({ bindingId: b.id, enabled: !b.enabled })
                        }
                      >
                        {b.enabled ? 'Выкл' : 'Вкл'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Удалить привязку?')) removeMutation.mutate(b.id);
                        }}
                      >
                        Удалить
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
