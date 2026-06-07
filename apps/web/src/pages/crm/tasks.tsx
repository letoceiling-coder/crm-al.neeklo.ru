import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { TASK_STATUS_LABELS, type CrmTask } from '@/lib/crm';
import { formatDate } from '@/lib/utils';

export function CrmTasksPage() {
  const { data: tasks = [], isLoading } = useQuery<CrmTask[]>({
    queryKey: ['crm-tasks'],
    queryFn: () => api.get('/v1/crm/tasks').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/crm"><ArrowLeft className="h-4 w-4 mr-1" />CRM</Link>
        </Button>
        <h1 className="text-2xl font-bold">Задачи</h1>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Заголовок</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Приоритет</th>
                <th className="px-4 py-3">Срок</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{TASK_STATUS_LABELS[t.status]}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{t.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.dueDate ? formatDate(t.dueDate) : '—'}
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
