import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CLIENT_STATUS_LABELS, type CrmClient, type TimelineItem } from '@/lib/crm';
import { formatDate } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Создан',
  UPDATED: 'Обновлён',
  STATUS_CHANGED: 'Изменение статуса',
  NOTE_ADDED: 'Комментарий',
  TOOL_EXECUTED: 'Вызов инструмента',
  COMMENT: 'Комментарий',
};

export function CrmClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const { data: client, isLoading } = useQuery<CrmClient>({
    queryKey: ['crm-client', id],
    queryFn: () => api.get(`/v1/crm/clients/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/crm/notes', {
        entityType: 'CLIENT',
        entityId: id,
        content: note.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-client', id] });
      setNote('');
    },
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (!client) return <Card><CardContent className="pt-6 text-destructive">Клиент не найден</CardContent></Card>;

  const timeline = client.timeline ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/crm/clients"><ArrowLeft className="h-4 w-4 mr-1" />Клиенты</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-muted-foreground">{client.company ?? client.email ?? '—'}</p>
        </div>
        <Badge variant="outline">{CLIENT_STATUS_LABELS[client.status]}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Контакты</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Email: {client.email ?? '—'}</p>
            <p>Телефон: {client.phone ?? '—'}</p>
            <p>Сайт: {client.website ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Добавить комментарий</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            <Button disabled={!note.trim()} onClick={() => noteMutation.mutate()}>Сохранить</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">История пуста</p>
          ) : (
            timeline.map((item: TimelineItem) => (
              <div key={`${item.kind}-${item.id}`} className="border-l-2 border-primary/30 pl-4 py-1">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(item.createdAt)}</span>
                  {item.kind === 'activity' && item.action && (
                    <Badge variant="outline">{ACTION_LABELS[item.action] ?? item.action}</Badge>
                  )}
                  {item.kind === 'note' && <Badge variant="outline">Комментарий</Badge>}
                  {item.createdBy && <span>{item.createdBy.name ?? item.createdBy.email}</span>}
                </div>
                {item.content && <p className="text-sm mt-1">{item.content}</p>}
                {item.kind === 'activity' && item.action === 'STATUS_CHANGED' && item.metadata && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    {String(item.metadata.from)} → {String(item.metadata.to)}
                  </p>
                )}
                {item.kind === 'activity' && item.action === 'TOOL_EXECUTED' && item.metadata && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Инструмент: {String(item.metadata.tool)}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
