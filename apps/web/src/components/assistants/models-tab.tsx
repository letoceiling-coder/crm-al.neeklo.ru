import { Cpu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AssistantEmptyState } from './empty-state';

interface PlatformModel {
  id: string;
  name: string;
  openrouterId: string;
  provider: string;
}

interface Props {
  settings: Record<string, unknown>;
}

function resolveChain(settings: Record<string, unknown>): string[] {
  const chain = settings.modelChain;
  if (Array.isArray(chain) && chain.length > 0) {
    return chain.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

export function AssistantModelsTab({ settings }: Props) {
  const savedIds = resolveChain(settings);

  const { data, isLoading } = useQuery<{ data: PlatformModel[] }>({
    queryKey: ['models-catalog'],
    queryFn: () => api.get('/models', { params: { limit: 100, enabled: true } }).then((r) => r.data),
  });

  const models = data?.data ?? [];
  const byId = new Map(models.map((m) => [m.id, m]));
  const byName = new Map(models.map((m) => [m.name.toLowerCase(), m]));

  const resolveModel = (ref: string) =>
    byId.get(ref) ?? byName.get(ref.toLowerCase()) ?? null;

  const chainModels = savedIds.map(resolveModel).filter(Boolean) as PlatformModel[];

  const suggested = models
    .filter((m) => /gpt-4|claude|gemini/i.test(m.name))
    .slice(0, 3);

  const configured = chainModels.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Цепочка моделей</CardTitle>
          <CardDescription>
            Основная, резервная и fallback-модели для ответов ассистента. Полная настройка маршрутизации — в следующем этапе.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : configured ? (
            <ol className="space-y-3">
              {chainModels.map((m, i) => (
                <li
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.provider}</p>
                  </div>
                  <Badge variant={i === 0 ? 'default' : 'outline'}>
                    {i === 0 ? 'Основная' : i === 1 ? 'Резервная' : 'Fallback'}
                  </Badge>
                  <Badge variant="success">Настроено</Badge>
                </li>
              ))}
            </ol>
          ) : (
            <AssistantEmptyState
              icon={Cpu}
              title="Модели не настроены"
              description="Выберите основную модель для работы ассистента. Ниже — пример рекомендуемой цепочки из каталога платформы."
            />
          )}
        </CardContent>
      </Card>

      {!configured && !isLoading && suggested.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Пример цепочки (предпросмотр)</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 opacity-80">
              {suggested.map((m, i) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <span className="font-medium truncate flex-1">{m.name}</span>
                  <Badge variant="outline">Не настроено</Badge>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground mt-4">
              Сохранение цепочки моделей будет доступно после подключения runtime в следующих этапах.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
