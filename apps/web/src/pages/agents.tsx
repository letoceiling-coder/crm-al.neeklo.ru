import { useQuery } from '@tanstack/react-query';
import { Bot, Thermometer } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/stat-card';

interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  temperature: number;
  maxContext: number;
  modelChain: Array<{ model: { name: string; openrouterId: string } }>;
  tools: Array<{ name: string; description?: string }>;
}

export function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents', { params: { limit: 50 } }).then((r) => r.data),
  });

  const agents: Agent[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Агенты</h1>
        <p className="text-muted-foreground">Готовые агенты с настроенными моделями и промптами</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !agents.length ? (
        <Card>
          <EmptyState icon={Bot} title="Агенты не найдены" description="Агенты будут доступны после настройки администратором" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl shrink-0">
                    {agent.avatar ?? '🤖'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <code className="text-xs text-muted-foreground">/v1/agents/{agent.slug}/chat</code>
                  </div>
                </div>

                {agent.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{agent.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    {agent.temperature}
                  </span>
                  <span>{(agent.maxContext / 1000).toFixed(0)}K ctx</span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Цепочка моделей:</div>
                  <div className="flex flex-wrap gap-1">
                    {agent.modelChain.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {i + 1}. {c.model.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {agent.tools.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {agent.tools.map((t) => (
                      <Badge key={t.name} variant="default" className="text-xs">{t.name}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
