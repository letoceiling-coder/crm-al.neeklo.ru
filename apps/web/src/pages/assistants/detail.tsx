import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, History } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssistantVariablesTab } from '@/components/assistants/variables-tab';
import { AssistantApiKeysTab } from '@/components/assistants/api-keys-tab';
import { AssistantModelsTab } from '@/components/assistants/models-tab';
import { AssistantConnectionsTab } from '@/components/assistants/connections-tab';
import { AssistantKnowledgeTab } from '@/components/assistants/knowledge-tab';
import { AssistantToolsTab } from '@/components/assistants/tools-tab';
import { AssistantMemoryTab } from '@/components/assistants/memory-tab';
import { AssistantChannelsTab } from '@/components/assistants/channels-tab';
import { AssistantReadinessCard } from '@/components/assistants/readiness-card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import { computeAssistantReadiness } from '@/lib/assistant-readiness';
import {
  AGENT_STATUS_LABELS,
  AGENT_TYPE_LABELS,
  type AgentStatus,
  type AgentType,
  type KeyAgentDetail,
} from '@/lib/assistants';
import { formatDate } from '@/lib/utils';

const STATUSES: AgentStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

export function AssistantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('general');

  const { data: assistant, isLoading, error } = useQuery<KeyAgentDetail>({
    queryKey: ['assistant', id],
    queryFn: () => api.get(`/v1/assistants/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('ASSISTANT');
  const [status, setStatus] = useState<AgentStatus>('DRAFT');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    if (assistant) {
      setName(assistant.name);
      setDescription(assistant.description ?? '');
      setAgentType(assistant.agentType);
      setStatus(assistant.status);
      setSystemPrompt(assistant.systemPrompt);
      setShowSources(Boolean((assistant.settings as { showSources?: boolean })?.showSources));
    }
  }, [assistant]);

  const saveShowSources = (v: boolean) => {
    setShowSources(v);
    api.patch(`/v1/assistants/${id}`, { settings: { ...(assistant?.settings ?? {}), showSources: v } });
  };

  const readinessSource = useMemo<KeyAgentDetail | null>(() => {
    if (!assistant) return null;
    return {
      ...assistant,
      name,
      agentType,
      systemPrompt,
    };
  }, [assistant, name, agentType, systemPrompt]);

  const readiness = readinessSource ? computeAssistantReadiness(readinessSource) : null;
  const activeKeyCount = assistant?.agentApiKeys.filter((k) => k.status === 'ACTIVE').length ?? 0;

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/v1/assistants/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        agentType,
        status,
        systemPrompt: systemPrompt.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant', id] });
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/assistants/${id}`),
    onSuccess: () => {
      window.location.href = '/assistants';
    },
  });

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !assistant) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Ассистент не найден или нет доступа.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/assistants">К списку</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link to="/assistants">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold break-words">{assistant.name}</h1>
            <code className="text-xs text-muted-foreground break-all">{assistant.slug}</code>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Тип ассистента</dt>
                <dd className="font-medium">{AGENT_TYPE_LABELS[assistant.agentType]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Статус</dt>
                <dd>
                  <Badge variant={assistant.status === 'ACTIVE' ? 'success' : 'outline'}>
                    {AGENT_STATUS_LABELS[assistant.status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ключи доступа</dt>
                <dd className="font-medium">{activeKeyCount} активных</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Создан</dt>
                <dd className="font-medium">{formatDate(assistant.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Последнее обновление</dt>
                <dd className="font-medium">{formatDate(assistant.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0 self-start"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm('Удалить ассистента?')) deleteMutation.mutate();
          }}
        >
          Удалить
        </Button>
      </div>

      {readiness && <AssistantReadinessCard readiness={readiness} />}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 h-auto flex-wrap gap-1">
            <TabsTrigger value="general">Основное</TabsTrigger>
            <TabsTrigger value="models">Модели</TabsTrigger>
            <TabsTrigger value="variables">Переменные</TabsTrigger>
            <TabsTrigger value="keys">Ключи доступа</TabsTrigger>
            <TabsTrigger value="connections">Подключения</TabsTrigger>
            <TabsTrigger value="knowledge">Базы знаний</TabsTrigger>
            <TabsTrigger value="tools">Инструменты</TabsTrigger>
            <TabsTrigger value="memory">Память</TabsTrigger>
            <TabsTrigger value="channels">Каналы</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основные настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assistant.template && (
                <p className="text-sm text-muted-foreground">
                  Шаблон:{' '}
                  <span className="font-medium text-foreground">{assistant.template.name}</span>
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Тип ассистента</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                    value={agentType}
                    onChange={(e) => setAgentType(e.target.value as AgentType)}
                  >
                    {Object.entries(AGENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm max-w-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AgentStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {AGENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="break-words"
                />
              </div>
              <div className="space-y-2">
                <Label>Системный промпт</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={10}
                  className="font-mono text-xs max-h-[480px] overflow-y-auto break-words"
                />
              </div>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <AssistantModelsTab settings={assistant.settings ?? {}} />
        </TabsContent>

        <TabsContent value="variables">
          <AssistantVariablesTab
            assistantId={assistant.id}
            variables={assistant.variables}
            systemPrompt={assistant.systemPrompt}
          />
        </TabsContent>

        <TabsContent value="keys">
          <AssistantApiKeysTab assistantId={assistant.id} keys={assistant.agentApiKeys} />
        </TabsContent>

        <TabsContent value="connections">
          <AssistantConnectionsTab />
        </TabsContent>

        <TabsContent value="knowledge">
          <AssistantKnowledgeTab
            assistantId={assistant.id}
            showSources={showSources}
            onToggleShowSources={saveShowSources}
          />
        </TabsContent>

        <TabsContent value="tools">
          <AssistantToolsTab assistantId={assistant.id} />
        </TabsContent>

        <TabsContent value="memory">
          <AssistantMemoryTab assistantId={assistant.id} assistantName={assistant.name} />
        </TabsContent>

        <TabsContent value="channels">
          <AssistantChannelsTab assistantId={assistant.id} />
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardContent className="pt-6">
              <AssistantEmptyState
                icon={BarChart3}
                title="Аналитика недоступна"
                description="Статистика использования ассистента появится в следующих этапах платформы."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <AssistantEmptyState
                icon={History}
                title="История пуста"
                description="Журнал изменений и аудит действий будут доступны в следующих этапах."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
