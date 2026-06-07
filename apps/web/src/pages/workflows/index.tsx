import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Play, History } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  STATUS_LABELS,
  TRIGGER_LABELS,
  type Workflow,
} from '@/lib/workflows';
import { formatDate } from '@/lib/utils';

export function WorkflowsListPage() {
  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: () => api.get('/v1/workflows').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Автоматизация</h1>
          <p className="text-muted-foreground">Workflow-сценарии для CRM, ассистентов и инструментов</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/workflows/templates">Шаблоны</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/workflows/executions">
              <History className="h-4 w-4 mr-2" />
              История
            </Link>
          </Button>
          <Button asChild>
            <Link to="/workflows/create">
              <Plus className="h-4 w-4 mr-2" />
              Создать
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет сценариев. Создайте первый workflow.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Триггер</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Запусков</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <Link to={`/workflows/${w.id}`} className="font-medium hover:text-primary">
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{TRIGGER_LABELS[w.triggerType]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={w.isActive ? 'success' : 'outline'}>
                      {w.isActive ? 'Активен' : STATUS_LABELS[w.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{w._count?.executions ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(w.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/workflows/${w.id}`}>
                        <Play className="h-4 w-4" />
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
