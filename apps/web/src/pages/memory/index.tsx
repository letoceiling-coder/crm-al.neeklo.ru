import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ENTITY_TYPE_LABELS, type MemoryProfile } from '@/lib/memory';
import { formatDate } from '@/lib/utils';

export function MemoryOverviewPage() {
  const { data: profiles = [], isLoading } = useQuery<MemoryProfile[]>({
    queryKey: ['memory-profiles'],
    queryFn: () => api.get('/v1/memory/profiles').then((r) => r.data),
  });

  const totalEntries = profiles.reduce((s, p) => s + (p._count?.entries ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7" />
            Память платформы
          </h1>
          <p className="text-muted-foreground">Долговременные знания для ассистентов, CRM и workflow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/memory/search">
              <Search className="h-4 w-4 mr-2" />
              Поиск
            </Link>
          </Button>
          <Button asChild>
            <Link to="/memory/profiles">
              <Plus className="h-4 w-4 mr-2" />
              Профили
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{profiles.length}</div>
            <div className="text-sm text-muted-foreground">Профилей памяти</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalEntries}</div>
            <div className="text-sm text-muted-foreground">Записей</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {profiles.filter((p) => p.entityType === 'ASSISTANT').length}
            </div>
            <div className="text-sm text-muted-foreground">Память ассистентов</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-4">Недавние профили</h2>
            <div className="space-y-2">
              {profiles.slice(0, 8).map((p) => (
                <Link
                  key={p.id}
                  to={`/memory/profiles/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.updatedAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ENTITY_TYPE_LABELS[p.entityType]}</Badge>
                    <span className="text-sm text-muted-foreground">{p._count?.entries ?? 0} записей</span>
                  </div>
                </Link>
              ))}
              {profiles.length === 0 && (
                <p className="text-muted-foreground text-sm">Профили создаются автоматически для ассистентов или вручную.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
