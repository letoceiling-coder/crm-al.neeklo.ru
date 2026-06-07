import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  INSTANCE_STATUS_LABELS,
  PROVIDER_TYPE_LABELS,
  type ToolDefinition,
  type ToolInstance,
} from '@/lib/tools';
import { formatDate } from '@/lib/utils';

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ERROR') return 'destructive';
  return 'outline';
}

export function ToolsInstancesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const createSlug = searchParams.get('create');
  const [showCreate, setShowCreate] = useState(Boolean(createSlug));
  const [name, setName] = useState('');
  const [slug, setSlug] = useState(createSlug ?? '');
  const [secret, setSecret] = useState('');

  const { data: instances = [], isLoading } = useQuery<ToolInstance[]>({
    queryKey: ['tool-instances'],
    queryFn: () => api.get('/v1/tools/instances').then((r) => r.data),
  });

  const { data: catalog = [] } = useQuery<ToolDefinition[]>({
    queryKey: ['tool-catalog'],
    queryFn: () => api.get('/v1/tools/catalog').then((r) => r.data),
    enabled: showCreate,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/tools/instances', {
        toolDefinitionSlug: slug,
        name: name.trim(),
        ...(secret ? { secret } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-instances'] });
      setShowCreate(false);
      setName('');
      setSecret('');
    },
  });

  const selectedDef = catalog.find((d) => d.slug === slug);
  const requiresSecret = Boolean(
    (selectedDef?.metadata as { requiresSecret?: boolean })?.requiresSecret,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tools">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Мои инструменты</h1>
            <p className="text-muted-foreground">Настроенные экземпляры для вашей организации</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Инструмент</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                >
                  <option value="">Выберите из каталога</option>
                  {catalog.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Название экземпляра</label>
                <Input
                  className="mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Telegram — поддержка"
                />
              </div>
            </div>
            {requiresSecret && (
              <div>
                <label className="text-sm text-muted-foreground">Секрет / токен</label>
                <Input
                  className="mt-1"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Будет сохранён зашифрованным"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                disabled={!slug || !name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Создать
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : !instances.length ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Нет подключённых инструментов. Выберите инструмент из{' '}
            <Link to="/tools/catalog" className="text-primary underline">
              каталога
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Последний запуск</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => {
                const last = inst.executionLogs?.[0];
                return (
                  <tr key={inst.id} className="border-b border-border/60">
                    <td className="px-4 py-3 font-medium">{inst.name}</td>
                    <td className="px-4 py-3">
                      {inst.definition.name} ({PROVIDER_TYPE_LABELS[inst.definition.providerType]})
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(inst.status)}>
                        {INSTANCE_STATUS_LABELS[inst.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {last ? `${last.status} · ${formatDate(last.createdAt)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/tools/${inst.id}`}>Открыть</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
