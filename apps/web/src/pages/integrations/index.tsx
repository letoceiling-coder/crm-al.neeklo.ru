import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plug, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PROVIDER_LABELS, STATUS_LABELS, type IntegrationProvider, type IntegrationAccount } from '@/lib/integrations';

export function IntegrationsOverviewPage() {
  const { data: providers = [] } = useQuery<IntegrationProvider[]>({
    queryKey: ['integration-providers'],
    queryFn: () => api.get('/v1/integrations/providers').then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<IntegrationAccount[]>({
    queryKey: ['integration-accounts'],
    queryFn: () => api.get('/v1/integrations/accounts').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-7 w-7" />
            Интеграции
          </h1>
          <p className="text-muted-foreground">Telegram, MAX, Email, CRM и внешние webhook</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/messages"><MessageSquare className="h-4 w-4 mr-2" />Сообщения</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((p) => (
          <Link key={p.id} to={`/integrations/${p.provider.toLowerCase()}`}>
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardContent className="pt-6">
                <div className="font-semibold">{p.name}</div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">Подключённые аккаунты ({accounts.length})</h2>
          <div className="space-y-2">
            {accounts.map((a) => (
              <Link
                key={a.id}
                to={`/integrations/accounts/${a.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{PROVIDER_LABELS[a.provider]}</div>
                </div>
                <Badge variant={a.status === 'ACTIVE' ? 'success' : 'outline'}>{STATUS_LABELS[a.status]}</Badge>
              </Link>
            ))}
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">Выберите провайдера выше, чтобы подключить аккаунт.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
