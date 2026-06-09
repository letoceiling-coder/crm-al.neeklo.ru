import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeSourcesTab } from '@/components/knowledge/sources-tab';
import { KnowledgeDocumentsTab } from '@/components/knowledge/documents-tab';
import { KnowledgeTaxonomyTab } from '@/components/knowledge/taxonomy-tab';
import { KnowledgeJobsTab } from '@/components/knowledge/jobs-tab';
import { KnowledgeChunksTab, KnowledgeEmbeddingsTab } from '@/components/knowledge/chunks-embeddings-tab';
import { KnowledgeHistoryTab } from '@/components/knowledge/history-tab';

import {
  KB_STATUS_LABELS,
  type KnowledgeBaseDetail,
  type KnowledgeBaseStatus,
  type KnowledgeSource,
  type KnowledgeDocument,
  type KnowledgeCategory,
  type KnowledgeTopic,
  type KnowledgeTag,
  type KbStats,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

const STATUSES: KnowledgeBaseStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'general');

  const { data: kb, isLoading, error } = useQuery<KnowledgeBaseDetail>({
    queryKey: ['knowledge-base', id],
    queryFn: () => api.get(`/v1/knowledge-bases/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: sources = [] } = useQuery<KnowledgeSource[]>({
    queryKey: ['knowledge-sources', id],
    queryFn: () =>
      api.get('/v1/knowledge-sources', { params: { knowledgeBaseId: id } }).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: documents = [] } = useQuery<KnowledgeDocument[]>({
    queryKey: ['knowledge-documents', id],
    queryFn: () =>
      api.get('/v1/knowledge-documents', { params: { knowledgeBaseId: id } }).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: categories = [] } = useQuery<KnowledgeCategory[]>({
    queryKey: ['knowledge-categories', id],
    queryFn: () =>
      api.get('/v1/knowledge-categories', { params: { knowledgeBaseId: id } }).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: topics = [] } = useQuery<KnowledgeTopic[]>({
    queryKey: ['knowledge-topics', id],
    queryFn: () =>
      api.get('/v1/knowledge-topics', { params: { knowledgeBaseId: id } }).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: tags = [] } = useQuery<KnowledgeTag[]>({
    queryKey: ['knowledge-tags', id],
    queryFn: () =>
      api.get('/v1/knowledge-tags', { params: { knowledgeBaseId: id } }).then((r) => r.data),
    enabled: Boolean(id),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<KnowledgeBaseStatus>('DRAFT');

  useEffect(() => {
    if (kb) {
      setName(kb.name);
      setDescription(kb.description ?? '');
      setStatus(kb.status);
    }
  }, [kb]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/v1/knowledge-bases/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/knowledge-bases/${id}`),
    onSuccess: () => {
      window.location.href = '/knowledge';
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  if (error || !kb) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">База знаний не найдена.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/knowledge">К списку</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = (kb.stats ?? {}) as KbStats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/knowledge">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words">{kb.name}</h1>
            <code className="text-xs text-muted-foreground">{kb.slug}</code>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant={kb.status === 'ACTIVE' ? 'success' : 'outline'}>
                {KB_STATUS_LABELS[kb.status]}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Документов</dt>
                <dd className="font-medium">{stats.documentCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Готовых</dt>
                <dd className="font-medium">{stats.readyCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Создана</dt>
                <dd className="font-medium">{formatDate(kb.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Обновлена</dt>
                <dd className="font-medium">{formatDate(kb.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm('Удалить базу знаний?')) deleteMutation.mutate();
          }}
        >
          Удалить
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0 h-auto flex-wrap gap-1">
            <TabsTrigger value="general">Основное</TabsTrigger>
            <TabsTrigger value="sources">Источники</TabsTrigger>
            <TabsTrigger value="documents">Документы</TabsTrigger>
            <TabsTrigger value="categories">Категории</TabsTrigger>
            <TabsTrigger value="topics">Темы</TabsTrigger>
            <TabsTrigger value="tags">Теги</TabsTrigger>
            <TabsTrigger value="stats">Статистика</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
            <TabsTrigger value="jobs">Задачи</TabsTrigger>
            <TabsTrigger value="chunks">Чанки</TabsTrigger>
            <TabsTrigger value="embeddings">Эмбеддинги</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основные настройки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm max-w-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as KnowledgeBaseStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {KB_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <KnowledgeSourcesTab knowledgeBaseId={kb.id} sources={sources} />
        </TabsContent>

        <TabsContent value="documents">
          <KnowledgeDocumentsTab knowledgeBaseId={kb.id} documents={documents} />
        </TabsContent>

        <TabsContent value="categories">
          <KnowledgeTaxonomyTab
            kind="categories"
            knowledgeBaseId={kb.id}
            categories={categories}
            topics={topics}
            tags={tags}
          />
        </TabsContent>

        <TabsContent value="topics">
          <KnowledgeTaxonomyTab
            kind="topics"
            knowledgeBaseId={kb.id}
            categories={categories}
            topics={topics}
            tags={tags}
          />
        </TabsContent>

        <TabsContent value="tags">
          <KnowledgeTaxonomyTab
            kind="tags"
            knowledgeBaseId={kb.id}
            categories={categories}
            topics={topics}
            tags={tags}
          />
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Статистика базы знаний</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Документов', stats.documentCount],
                  ['Источников', stats.sourceCount],
                  ['Готовых', stats.readyCount],
                  ['Ожидают', stats.pendingCount],
                  ['Ошибок', stats.failedCount],
                  ['Пропущено (качество)', stats.skippedQualityCount],
                  ['Чанков', stats.chunkCount ?? 0],
                  ['Проиндексировано', stats.indexedCount ?? 0],
                  ['Всего символов', stats.totalChars],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border p-4">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-bold mt-1">{value ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <KnowledgeHistoryTab knowledgeBaseId={kb.id} />
        </TabsContent>

        <TabsContent value="jobs">
          <KnowledgeJobsTab knowledgeBaseId={kb.id} />
        </TabsContent>

        <TabsContent value="chunks">
          <KnowledgeChunksTab knowledgeBaseId={kb.id} />
        </TabsContent>

        <TabsContent value="embeddings">
          <KnowledgeEmbeddingsTab knowledgeBaseId={kb.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
