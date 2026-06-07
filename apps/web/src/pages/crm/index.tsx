import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Handshake, ListTodo } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PIPELINE_LABELS, PIPELINE_STAGES, type CrmOverview } from '@/lib/crm';

export function CrmOverviewPage() {
  const { data, isLoading } = useQuery<CrmOverview>({
    queryKey: ['crm-overview'],
    queryFn: () => api.get('/v1/crm').then((r) => r.data),
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  const counts = data?.counts ?? { clients: 0, leads: 0, deals: 0, tasks: 0 };
  const pipelineMap = new Map(data?.pipeline.map((p) => [p.stage, p.count]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CRM</h1>
        <p className="text-muted-foreground">Внутренняя CRM платформа организации</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { to: '/crm/clients', icon: Users, label: 'Клиенты', count: counts.clients },
          { to: '/crm/leads', icon: UserPlus, label: 'Лиды', count: counts.leads },
          { to: '/crm/deals', icon: Handshake, label: 'Сделки', count: counts.deals },
          { to: '/crm/tasks', icon: ListTodo, label: 'Задачи', count: counts.tasks },
        ].map(({ to, icon: Icon, label, count }) => (
          <Card key={to}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={to}>
                  <Icon className="h-4 w-4 mr-1" />
                  Открыть
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline — лиды</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage} className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">{PIPELINE_LABELS[stage]}</p>
                <p className="text-xl font-semibold">{pipelineMap.get(stage) ?? 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
