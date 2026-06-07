import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/input';
import { TRIGGER_LABELS } from '@/lib/workflows';

interface WorkflowTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  triggerType: keyof typeof TRIGGER_LABELS;
  usageCount: number;
  category: { name: string; slug: string };
}

interface TemplateCategory {
  id: string;
  slug: string;
  name: string;
  templates: WorkflowTemplate[];
}

export function WorkflowTemplatesPage() {
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<TemplateCategory[]>({
    queryKey: ['workflow-template-categories'],
    queryFn: () => api.get('/v1/workflows/templates/categories').then((r) => r.data),
  });

  const instantiate = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/v1/workflows/templates/${templateId}/instantiate`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow-template-categories'] });
    },
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Шаблоны автоматизации</h1>
          <p className="text-sm text-muted-foreground">Готовые сценарии для быстрого старта</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/workflows">Мои workflow</Link>
        </Button>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{cat.name}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {cat.templates.map((tpl) => (
              <Card key={tpl.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{tpl.name}</div>
                      <p className="text-sm text-muted-foreground mt-1">{tpl.description}</p>
                    </div>
                    <Badge variant="outline">{TRIGGER_LABELS[tpl.triggerType]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Использований: {tpl.usageCount}</span>
                    <Button
                      size="sm"
                      disabled={instantiate.isPending}
                      onClick={() => instantiate.mutate(tpl.id)}
                    >
                      Создать workflow
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
