import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PROVIDER_TYPE_LABELS, type ToolDefinition } from '@/lib/tools';

export function ToolsCatalogPage() {
  const { data: catalog = [], isLoading } = useQuery<ToolDefinition[]>({
    queryKey: ['tool-catalog'],
    queryFn: () => api.get('/v1/tools/catalog').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tools">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Каталог инструментов</h1>
          <p className="text-muted-foreground">Системные определения инструментов платформы</p>
        </div>
        <Button asChild>
          <Link to="/tools/instances">
            <Plus className="h-4 w-4 mr-2" />
            Мои инструменты
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.map((tool) => (
            <Card key={tool.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{tool.name}</h3>
                  <Badge variant="outline">{PROVIDER_TYPE_LABELS[tool.providerType]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {tool.description ?? '—'}
                </p>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to={`/tools/instances?create=${tool.slug}`}>
                    Подключить
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
