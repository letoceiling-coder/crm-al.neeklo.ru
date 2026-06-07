import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import { AGENT_TYPE_LABELS, type AgentTemplate } from '@/lib/assistants';

export function AssistantTemplatesPage() {
  const { data: templates, isLoading, error } = useQuery<AgentTemplate[]>({
    queryKey: ['assistant-templates'],
    queryFn: () => api.get('/v1/assistants/templates').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Шаблоны ассистентов</h1>
          <p className="text-muted-foreground">Готовые шаблоны для быстрого создания ассистентов</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            Не удалось загрузить шаблоны.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !templates?.length ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={LayoutTemplate}
              title="Шаблоны не найдены"
              description="Обратитесь к администратору для настройки шаблонов платформы."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base break-words">{t.name}</CardTitle>
                <CardDescription className="line-clamp-3">{t.description ?? '—'}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <Badge variant="outline">{AGENT_TYPE_LABELS[t.agentType]}</Badge>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/assistants/create">Создать из шаблона</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
