import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, BookMarked, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/stat-card';
import { KB_STATUS_LABELS, type KnowledgeBaseListItem } from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'outline' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'outline';
}

export function KnowledgeListPage() {
  const { data: bases, isLoading, error } = useQuery<KnowledgeBaseListItem[]>({
    queryKey: ['knowledge-bases'],
    queryFn: () => api.get('/v1/knowledge-bases').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Базы знаний</h1>
          <p className="text-muted-foreground">Хранение и управление корпоративными знаниями</p>
        </div>
        <Button asChild>
          <Link to="/knowledge/create">
            <Plus className="h-4 w-4 mr-2" />
            Создать базу знаний
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            Не удалось загрузить базы знаний.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !bases?.length ? (
        <Card>
          <EmptyState
            icon={BookMarked}
            title="Нет баз знаний"
            description="Создайте первую базу знаний для хранения документов и источников"
            action={
              <Button asChild>
                <Link to="/knowledge/create">Создать базу знаний</Link>
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
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Документы</th>
                <th className="px-4 py-3 font-medium">Источники</th>
                <th className="px-4 py-3 font-medium">Обновлена</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bases.map((kb) => (
                <tr key={kb.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium break-words max-w-[200px]">{kb.name}</div>
                    <code className="text-xs text-muted-foreground">{kb.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(kb.status)}>{KB_STATUS_LABELS[kb.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">{kb._count?.documents ?? kb.stats?.documentCount ?? 0}</td>
                  <td className="px-4 py-3">{kb._count?.sources ?? kb.stats?.sourceCount ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(kb.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/knowledge/${kb.id}`}>
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
