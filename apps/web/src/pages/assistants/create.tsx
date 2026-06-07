import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AGENT_TYPE_LABELS,
  AGENT_STATUS_LABELS,
  type AgentTemplate,
  type AgentType,
  type AgentStatus,
} from '@/lib/assistants';
import { cn } from '@/lib/utils';

const STATUSES: AgentStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

export function AssistantsCreatePage() {
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('ASSISTANT');
  const [status, setStatus] = useState<AgentStatus>('DRAFT');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: templates, isLoading: templatesLoading } = useQuery<AgentTemplate[]>({
    queryKey: ['assistant-templates'],
    queryFn: () => api.get('/v1/assistants/templates').then((r) => r.data),
  });

  const selectTemplate = (t: AgentTemplate) => {
    setSelectedTemplateId(t.id);
    setName(t.name);
    setDescription(t.description ?? '');
    setAgentType(t.agentType);
    setSystemPrompt(t.defaultPrompt);
    setSlug('');
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Укажите название';
    if (!systemPrompt.trim() && !selectedTemplateId) {
      next.systemPrompt = 'Укажите системный промпт или выберите шаблон';
    }
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      next.slug = 'Slug: только a-z, 0-9 и дефис';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/assistants', {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        agentType,
        status,
        systemPrompt: systemPrompt.trim(),
        templateId: selectedTemplateId ?? undefined,
      }),
    onSuccess: (res) => navigate(`/assistants/${res.data.id}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/assistants">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Создание ассистента</h1>
          <p className="text-muted-foreground">Выберите шаблон и настройте параметры</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Шаблон</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors hover:border-primary/50',
                    selectedTemplateId === t.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    {selectedTemplateId === t.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {AGENT_TYPE_LABELS[t.agentType]}
                  </Badge>
                  {t.description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Параметры</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Юридический ассистент"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (опционально)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="legal-assistant"
                />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agentType">Тип</Label>
                <select
                  id="agentType"
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
              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">Системный промпт *</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="Вы — ассистент компании {{company_name}}..."
                className="max-h-96 overflow-y-auto break-words"
              />
              {errors.systemPrompt && (
                <p className="text-xs text-destructive">{errors.systemPrompt}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Поддерживаются переменные: {'{{company_name}}'}, {'{{phone}}'}, {'{{email}}'}, {'{{website}}'}, {'{{crm_url}}'}
              </p>
            </div>
          </CardContent>
        </Card>

        {createMutation.isError && (
          <p className="text-sm text-destructive">
            {(createMutation.error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? 'Ошибка создания'}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Создание…' : 'Создать ассистента'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/assistants">Отмена</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
