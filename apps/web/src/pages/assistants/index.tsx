import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Bot, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/stat-card';
import {
  AGENT_STATUS_LABELS,
  AGENT_TYPE_LABELS,
  type KeyAgentListItem,
} from '@/lib/assistants';
import { formatDate } from '@/lib/utils';

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'outline' | 'destructive' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'ARCHIVED') return 'outline';
  if (status === 'INACTIVE') return 'destructive';
  return 'outline';
}

export function AssistantsListPage() {
  const { data: assistants, isLoading, error } = useQuery<KeyAgentListItem[]>({
    queryKey: ['assistants'],
    queryFn: () => api.get('/v1/assistants').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Ассистенты</h1>
          <p className="text-muted-foreground">Управление ассистентами организации</p>
        </div>
        <Button asChild>
          <Link to="/assistants/create">
            <Plus className="h-4 w-4 mr-2" />
            Создать ассистента
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            Не удалось загрузить ассистентов. Проверьте авторизацию и доступ к API.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !assistants?.length ? (
        <Card>
          <EmptyState
            icon={Bot}
            title="Нет ассистентов"
            description="Создайте первого AI ассистента из шаблона или с нуля"
            action={
              <Button asChild>
                <Link to="/assistants/create">Создать ассистента</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Ключи доступа</th>
                <th className="px-4 py-3 font-medium">Создан</th>
                <th className="px-4 py-3 font-medium">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assistants.map((a) => (
                <tr key={a.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium break-words max-w-[200px]">{a.name}</div>
                    <code className="text-xs text-muted-foreground break-all">{a.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{AGENT_TYPE_LABELS[a.agentType] ?? a.agentType}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(a.status)}>
                      {AGENT_STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{a._count?.agentApiKeys ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(a.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/assistants/${a.id}`}>
                        Открыть
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
