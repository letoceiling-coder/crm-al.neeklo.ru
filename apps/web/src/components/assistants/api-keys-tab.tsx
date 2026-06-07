import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Ban, Key, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from './empty-state';
import {
  ENV_LABELS,
  SCOPE_LABELS,
  KEY_STATUS_LABELS,
  type AgentApiKeyEnvironment,
  type AgentApiKeyListItem,
  type AgentApiKeyScope,
} from '@/lib/assistants';
import { formatDate } from '@/lib/utils';

const ALL_SCOPES: AgentApiKeyScope[] = [
  'CHAT',
  'TOOLS_INVOKE',
  'KB_READ',
  'MEMORY_READ',
  'MEMORY_WRITE',
  'CRM_READ',
  'CRM_WRITE',
  'ADMIN',
];

const ALL_ENVS: AgentApiKeyEnvironment[] = [
  'PRODUCTION',
  'TEST',
  'CRM',
  'TELEGRAM',
  'WEBHOOK',
  'INTERNAL',
];

interface ApiKeyOption {
  id: string;
  name: string;
  keyPrefix: string;
}

interface Props {
  assistantId: string;
  keys: AgentApiKeyListItem[];
}

export function AssistantApiKeysTab({ assistantId, keys }: Props) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [environment, setEnvironment] = useState<AgentApiKeyEnvironment>('PRODUCTION');
  const [scopes, setScopes] = useState<AgentApiKeyScope[]>([
    'CHAT',
    'TOOLS_INVOKE',
    'KB_READ',
    'MEMORY_READ',
    'MEMORY_WRITE',
  ]);
  const [expiresAt, setExpiresAt] = useState('');

  const { data: billingKeys } = useQuery<ApiKeyOption[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/assistants/${assistantId}/keys`, {
        name: name.trim(),
        apiKeyId,
        environment,
        scopes,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: (res) => {
      setNewKeyPlain(res.data.key ?? null);
      setShowCreate(false);
      setName('');
      invalidate();
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (keyId: string) => api.post(`/v1/assistants/${assistantId}/keys/${keyId}/rotate`, {}),
    onSuccess: (res) => {
      setNewKeyPlain(res.data.key ?? null);
      invalidate();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.post(`/v1/assistants/${assistantId}/keys/${keyId}/revoke`),
    onSuccess: invalidate,
  });

  const revealKey = async (keyId: string) => {
    const { data } = await api.get<{ key: string }>(
      `/v1/assistants/${assistantId}/keys/${keyId}/reveal`,
    );
    setNewKeyPlain(data.key);
  };

  const copyKey = async () => {
    if (!newKeyPlain) return;
    await navigator.clipboard.writeText(newKeyPlain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: AgentApiKeyScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const keyStatusLabel = (status: string) => KEY_STATUS_LABELS[status] ?? status;

  return (
    <div className="space-y-6">
      {newKeyPlain && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">
              Новый ключ (скопируйте сейчас — больше не покажем):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 rounded-lg bg-background border px-3 py-2 text-xs break-all">
                {newKeyPlain}
              </code>
              <Button type="button" variant="outline" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setNewKeyPlain(null)}
            >
              Закрыть
            </Button>
          </CardContent>
        </Card>
      )}

      {keys.length > 0 && !showCreate && (
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Key className="h-4 w-4 mr-2" />
          Создать agt_ ключ
        </Button>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новый ключ доступа ассистента</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Продакшен" />
              </div>
              <div className="space-y-2">
                <Label>Биллинговый ключ (agw_) *</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                  value={apiKeyId}
                  onChange={(e) => setApiKeyId(e.target.value)}
                >
                  <option value="">Выберите ключ</option>
                  {billingKeys?.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.keyPrefix}…)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Окружение</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as AgentApiKeyEnvironment)}
                >
                  {ALL_ENVS.map((e) => (
                    <option key={e} value={e}>
                      {ENV_LABELS[e]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Срок действия (необязательно)</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Области доступа</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className="focus:outline-none"
                  >
                    <Badge variant={scopes.includes(s) ? 'default' : 'outline'}>{SCOPE_LABELS[s]}</Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!name.trim() || !apiKeyId || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Создать
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {keys.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={Key}
              title="Нет ключей доступа"
              description="Создайте первый agt_ ключ для интеграции ассистента с внешними системами."
              action={
                <Button type="button" onClick={() => setShowCreate(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Создать agt_ ключ
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : keys.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Префикс</th>
                <th className="px-4 py-3">Окружение</th>
                <th className="px-4 py-3">Области</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Истекает</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium break-words max-w-[160px]">{k.name}</td>
                  <td className="px-4 py-3">
                    <code>{k.keyPrefix}…</code>
                  </td>
                  <td className="px-4 py-3">{ENV_LABELS[k.environment]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {k.scopes.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {SCOPE_LABELS[s]}
                        </Badge>
                      ))}
                      {k.scopes.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{k.scopes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={k.status === 'ACTIVE' ? 'success' : 'destructive'}>
                      {keyStatusLabel(k.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {k.expiresAt ? formatDate(k.expiresAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => revealKey(k.id)}>
                        Показать
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={rotateMutation.isPending}
                        onClick={() => rotateMutation.mutate(k.id)}
                        title="Перевыпустить"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={k.status !== 'ACTIVE' || revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(k.id)}
                        title="Отозвать"
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
