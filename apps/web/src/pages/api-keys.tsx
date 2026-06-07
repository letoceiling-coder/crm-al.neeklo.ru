import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, RefreshCw, Ban, Key, Check, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/stat-card';
import {
  ApiKeyForm,
  emptyFormValues,
  formToPayload,
  keyToFormValues,
  useModelsForPayload,
} from '@/components/api-keys/api-key-form';
import { KeyBalancePanel } from '@/components/api-keys/key-balance-panel';
import { formatDate, formatCurrency } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  comment?: string;
  allowedIps?: string[];
  allowedDomains?: string[];
  rateLimit?: number;
  tokenLimit?: string;
  tokensUsed: string;
  balanceRub?: string | number;
  spentRub?: string | number;
  pricePerMillionRub?: string | number;
  requestsUsed: number;
  modelProfile?: { id: string; name: string; slug: string; pricePerMillionRub?: number };
  routingMode?: string;
  modelProfileId?: string | null;
  lastUsedAt?: string;
  createdAt: string;
  modelChain: Array<{
    modelId: string;
    priority: number;
    model: { id: string; name: string };
  }>;
  pricing?: Array<{
    modelId: string;
    sellPrice: string | number;
    costPrice: string | number;
    model?: { name: string };
  }>;
}

export function ApiKeysPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyFormValues());
  const [editForm, setEditForm] = useState(emptyFormValues());
  const queryClient = useQueryClient();
  const models = useModelsForPayload();

  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data),
  });

  const closePanels = () => {
    setShowCreate(false);
    setEditingId(null);
    setCreateForm(emptyFormValues());
    setEditForm(emptyFormValues());
  };

  const stashKeyInBrowser = (keyId: string, fullKey: string) => {
    try {
      sessionStorage.setItem(`agw-key-${keyId}`, fullKey);
    } catch {
      /* ignore */
    }
  };

  const copyFullKey = async (keyId: string) => {
    const stashed = sessionStorage.getItem(`agw-key-${keyId}`);
    if (stashed) {
      await navigator.clipboard.writeText(stashed);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
      return;
    }
    try {
      const { data } = await api.get<{ key: string }>(`/api-keys/${keyId}/reveal`);
      await navigator.clipboard.writeText(data.key);
      stashKeyInBrowser(keyId, data.key);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      alert(
        'Полный ключ недоступен. Нажмите «Регенерировать» — новый ключ можно будет скопировать.',
      );
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formToPayload>) => api.post('/api-keys', data),
    onSuccess: (res) => {
      setNewKey(res.data.key);
      if (res.data.id) stashKeyInBrowser(res.data.id, res.data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      closePanels();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnType<typeof formToPayload> }) =>
      api.put(`/api-keys/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      closePanels();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api-keys/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      closePanels();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api-keys/${id}/regenerate`),
    onSuccess: (res, keyId) => {
      setNewKey(res.data.key);
      stashKeyInBrowser(keyId, res.data.key);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = async (key: ApiKey) => {
    setShowCreate(false);
    setEditingId(key.id);
    const { data } = await api.get(`/api-keys/${key.id}`);
    setEditForm(keyToFormValues(data));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'success' | 'destructive' | 'warning' | 'outline'> = {
      ACTIVE: 'success',
      BLOCKED: 'destructive',
      LIMIT_EXCEEDED: 'warning',
      INACTIVE: 'outline',
    };
    return <Badge variant={map[status] ?? 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Мои API ключи</h1>
          <p className="text-muted-foreground">Управление ключами доступа к AI Gateway</p>
        </div>
        <Button
          onClick={() => {
            closePanels();
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Создать ключ
        </Button>
      </div>

      {newKey && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">
              Ключ создан или обновлён. Сохраните значение — больше не будет показан:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-background/50 border border-border px-3 py-2 text-sm font-mono break-all">
                {newKey}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyKey(newKey)}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Новый API ключ</CardTitle>
          </CardHeader>
          <CardContent>
            <ApiKeyForm
              values={createForm}
              onChange={setCreateForm}
              onSubmit={() => createMutation.mutate(formToPayload(createForm, models))}
              onCancel={closePanels}
              submitLabel="Создать"
              isPending={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {editingId && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Редактирование ключа</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyBalancePanel apiKeyId={editingId} />
            <ApiKeyForm
              values={editForm}
              onChange={setEditForm}
              isEdit
              onSubmit={() =>
                updateMutation.mutate({
                  id: editingId,
                  data: formToPayload(editForm, models, { isEdit: true }),
                })
              }
              onCancel={closePanels}
              submitLabel="Сохранить настройки"
              isPending={updateMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !keys?.length ? (
        <Card>
          <EmptyState
            icon={Key}
            title="Нет API ключей"
            description="Создайте первый ключ для доступа к AI моделям и агентам"
            action={
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Создать ключ
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card
              key={key.id}
              className={
                editingId === key.id
                  ? 'ring-2 ring-primary/40'
                  : 'hover:shadow-md transition-shadow'
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{key.name}</h3>
                      {statusBadge(key.status)}
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-sm text-muted-foreground font-mono">
                        {key.keyPrefix}••••••••
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Копировать полный API-ключ"
                        onClick={() => copyFullKey(key.id)}
                      >
                        {copiedKeyId === key.id ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    {key.comment && (
                      <p className="text-sm text-muted-foreground mt-1">{key.comment}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                      {Number(key.balanceRub) > 0 && (
                        <span>
                          Баланс: {formatCurrency(Number(key.balanceRub) - Number(key.spentRub ?? 0))} /{' '}
                          {formatCurrency(Number(key.balanceRub))}
                        </span>
                      )}
                      {Number(key.pricePerMillionRub) > 0 && (
                        <span>{formatCurrency(Number(key.pricePerMillionRub))} / 1M tok</span>
                      )}
                      <span>{key.requestsUsed} запросов</span>
                      <span>{key.tokensUsed} токенов</span>
                      <span>Создан: {formatDate(key.createdAt)}</span>
                    </div>
                    {key.modelProfile ? (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">Модель-профиль:</p>
                        <Badge variant="outline" className="text-xs">
                          {key.modelProfile.name} ({key.modelProfile.slug})
                        </Badge>
                      </div>
                    ) : key.modelChain?.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">
                          Цепочка моделей (fallback):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {key.modelChain
                            .sort((a, b) => a.priority - b.priority)
                            .map((c, i) => (
                              <Badge key={c.model.id} variant="outline" className="text-xs">
                                {i + 1}. {c.model.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Модель по умолчанию: <Badge variant="outline">auto</Badge>
                        {key.modelChain?.length ? '' : ' · fallback — глобальная цепочка'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Редактировать"
                      onClick={() => startEdit(key)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Регенерировать"
                      onClick={() => regenerateMutation.mutate(key.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    {key.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Деактивировать"
                        onClick={() => deactivateMutation.mutate(key.id)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
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
