import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  type KnowledgeJob,
  type KnowledgeJobStatus,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

interface Props {
  knowledgeBaseId?: string;
}

function statusVariant(status: KnowledgeJobStatus) {
  if (status === 'SUCCESS') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  if (status === 'RUNNING') return 'default' as const;
  return 'outline' as const;
}

export function KnowledgeJobsTab({ knowledgeBaseId }: Props) {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery<KnowledgeJob[]>({
    queryKey: ['knowledge-jobs', knowledgeBaseId ?? 'all'],
    queryFn: () =>
      api
        .get('/v1/knowledge-jobs', {
          params: knowledgeBaseId ? { knowledgeBaseId } : undefined,
        })
        .then((r) => r.data),
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/knowledge-jobs/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-jobs'] }),
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AssistantEmptyState
            icon={ListTodo}
            title="Задач нет"
            description="Задачи появятся при добавлении URL, файлов или источников"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Источник / документ</th>
            {!knowledgeBaseId && <th className="px-4 py-3">База знаний</th>}
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Прогресс</th>
            <th className="px-4 py-3">Запуск</th>
            <th className="px-4 py-3">Завершение</th>
            <th className="px-4 py-3">Ошибка</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-border/60">
              <td className="px-4 py-3">{JOB_TYPE_LABELS[job.type]}</td>
              <td className="px-4 py-3 max-w-[200px] break-words">
                {job.knowledgeSource?.name ??
                  job.knowledgeSource?.url ??
                  job.knowledgeDocument?.title ??
                  '—'}
              </td>
              {!knowledgeBaseId && (
                <td className="px-4 py-3">
                  {job.knowledgeBase ? (
                    <Link
                      to={`/knowledge/${job.knowledgeBase.id}?tab=jobs`}
                      className="text-primary hover:underline"
                    >
                      {job.knowledgeBase.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status]}</Badge>
              </td>
              <td className="px-4 py-3">{job.progress ?? 0}%</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {job.startedAt ? formatDate(job.startedAt) : formatDate(job.createdAt)}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {job.finishedAt ? formatDate(job.finishedAt) : '—'}
              </td>
              <td className="px-4 py-3 text-destructive text-xs max-w-[160px] truncate">
                {job.error ?? '—'}
              </td>
              <td className="px-4 py-3">
                {(job.status === 'QUEUED' || job.status === 'RUNNING') && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(job.id)}
                  >
                    Отмена
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KnowledgeJobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Задачи обработки</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Очередь ingestion: парсинг URL, sitemap, домены, файлы и ZIP
        </p>
      </div>
      <KnowledgeJobsTab />
    </div>
  );
}
