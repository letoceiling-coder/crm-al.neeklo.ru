import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, X, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface ChainItem {
  modelId: string;
  priority: number;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  openrouterId: string;
  description?: string;
  inputPrice: string;
  outputPrice: string;
  isFree: boolean;
  labels: string[];
}

interface ModelChainPickerProps {
  value: ChainItem[];
  onChange: (chain: ChainItem[]) => void;
  sellPrices: Record<string, string>;
  onSellPricesChange: (prices: Record<string, string>) => void;
}

export function useModelsCatalog() {
  return useQuery({
    queryKey: ['models-for-chain'],
    queryFn: () => api.get('/models').then((r) => r.data),
  });
}

export function ModelChainPicker({
  value,
  onChange,
  sellPrices,
  onSellPricesChange,
}: ModelChainPickerProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useModelsCatalog();

  const models: ModelOption[] = data?.data ?? [];
  const selectedIds = new Set(value.map((v) => v.modelId));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return models
      .filter((m) => !selectedIds.has(m.id))
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.openrouterId.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [models, selectedIds, search]);

  const addModel = (model: ModelOption) => {
    onChange([...value, { modelId: model.id, priority: value.length }]);
    const cost = Number(model.inputPrice);
    if (!sellPrices[model.id]) {
      onSellPricesChange({
        ...sellPrices,
        [model.id]: cost > 0 ? String(cost) : '0',
      });
    }
    setSearch('');
  };

  const removeAt = (index: number) => {
    const removed = value[index];
    onChange(
      value
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, priority: i })),
    );
    if (removed) {
      const next = { ...sellPrices };
      delete next[removed.modelId];
      onSellPricesChange(next);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= value.length) return;
    const items = [...value];
    [items[index], items[next]] = [items[next], items[index]];
    onChange(items.map((item, i) => ({ ...item, priority: i })));
  };

  const getModel = (id: string) => models.find((m) => m.id === id);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Цепочка моделей (fallback)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          При недоступности модели запрос автоматически перейдёт к следующей в цепочке
        </p>
      </div>

      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((item, index) => {
            const model = getModel(item.modelId);
            if (!model) return null;
            const realCost = Number(model.inputPrice);
            return (
              <div
                key={item.modelId}
                className="rounded-lg border border-border p-3 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      {model.isFree && (
                        <Badge variant="free" className="text-xs">
                          FREE
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {model.provider}
                      </span>
                    </div>
                    {model.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {model.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Себестоимость: {formatCurrency(realCost)}/1M in ·{' '}
                      {formatCurrency(Number(model.outputPrice))}/1M out
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === value.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeAt(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="pl-10">
                  <label className="text-xs font-medium text-muted-foreground">
                    Ваша цена за 1M токенов (₽) — для биллинга клиента
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 h-9"
                    value={sellPrices[item.modelId] ?? ''}
                    onChange={(e) =>
                      onSellPricesChange({
                        ...sellPrices,
                        [item.modelId]: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border p-2">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Поиск модели по названию или провайдеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted" />
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => addModel(m)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      {m.isFree && (
                        <Badge variant="free" className="text-xs shrink-0">
                          FREE
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{m.provider}</span>
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {m.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs">
                    <div className="font-medium">
                      {m.isFree ? 'Бесплатно' : formatCurrency(Number(m.inputPrice))}
                    </div>
                    <div className="text-muted-foreground">/1M in</div>
                  </div>
                </div>
              </button>
            ))}
            {!filtered.length && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {search ? 'Модели не найдены' : 'Все модели уже добавлены'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
