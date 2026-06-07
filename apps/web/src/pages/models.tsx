import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Cpu } from 'lucide-react';
import { api } from '@/lib/api';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/stat-card';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface Model {
  id: string;
  openrouterId: string;
  name: string;
  provider: string;
  description?: string;
  contextLength: number;
  inputPrice: string;
  outputPrice: string;
  speed?: string;
  capabilities: string[];
  labels: string[];
  isFree: boolean;
}

const labelColors: Record<string, 'free' | 'default' | 'success' | 'warning' | 'outline'> = {
  FREE: 'free',
  CHEAP: 'success',
  FAST: 'default',
  PREMIUM: 'warning',
  REASONING: 'outline',
  VISION: 'outline',
  CODING: 'outline',
  AGENT: 'outline',
};

export function ModelsPage() {
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['models', search, provider],
    queryFn: () =>
      api
        .get('/models', {
          params: {
            ...(search ? { search } : {}),
            ...(provider ? { provider } : {}),
          },
        })
        .then((r) => r.data),
  });

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/models/providers').then((r) => r.data),
  });

  const models: Model[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Каталог моделей</h1>
        <p className="text-muted-foreground">Все модели OpenRouter с ценами и возможностями</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Поиск моделей..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-lg border border-border bg-background/50 px-3 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Все провайдеры</option>
          {(providers ?? []).map((p: { name: string; count: number }) => (
            <option key={p.name} value={p.name}>{p.name} ({p.count})</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !models.length ? (
        <Card>
          <EmptyState icon={Cpu} title="Модели не найдены" description="Попробуйте изменить фильтры или синхронизируйте каталог" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Card key={model.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="pt-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm leading-tight">{model.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{model.provider}</p>
                  </div>
                  {model.isFree && <Badge variant="free">FREE</Badge>}
                </div>

                {model.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{model.description}</p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {model.labels.filter((l) => l !== 'FREE').map((label) => (
                    <Badge key={label} variant={labelColors[label] ?? 'outline'} className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
                  <div>
                    <span className="text-muted-foreground">Input</span>
                    <div className="font-medium">{formatCurrency(Number(model.inputPrice))}/1M</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Output</span>
                    <div className="font-medium">{formatCurrency(Number(model.outputPrice))}/1M</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Контекст</span>
                    <div className="font-medium">{formatNumber(model.contextLength)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Скорость</span>
                    <div className="font-medium">{model.speed ?? '—'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
