import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Eye, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from './empty-state';
import {
  SEARCH_MODE_LABELS,
  type AssistantKnowledgeBinding,
  type AssistantSearchMode,
  type ContextPreviewResult,
} from '@/lib/assistants';

interface Props {
  assistantId: string;
  showSources: boolean;
  onToggleShowSources: (v: boolean) => void;
}

interface KnowledgeBaseOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function AssistantKnowledgeTab({
  assistantId,
  showSources,
  onToggleShowSources,
}: Props) {
  const queryClient = useQueryClient();
  const [kbId, setKbId] = useState('');
  const [previewQuery, setPreviewQuery] = useState('');
  const [preview, setPreview] = useState<ContextPreviewResult | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatSources, setChatSources] = useState<ContextPreviewResult['chunks']>([]);

  const { data: bindings = [], isLoading } = useQuery<AssistantKnowledgeBinding[]>({
    queryKey: ['assistant-kb-bindings', assistantId],
    queryFn: () => api.get(`/v1/assistants/${assistantId}/knowledge-bindings`).then((r) => r.data),
  });

  const { data: knowledgeBases = [] } = useQuery<KnowledgeBaseOption[]>({
    queryKey: ['knowledge-bases-list'],
    queryFn: () => api.get('/v1/knowledge-bases').then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/assistants/${assistantId}/knowledge-bindings`, {
        knowledgeBaseId: kbId,
        searchMode: 'HYBRID',
        priority: bindings.length,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistant-kb-bindings', assistantId] });
      setKbId('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ bindingId, enabled }: { bindingId: string; enabled: boolean }) =>
      api.patch(`/v1/assistants/${assistantId}/knowledge-bindings/${bindingId}`, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assistant-kb-bindings', assistantId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (bindingId: string) =>
      api.delete(`/v1/assistants/${assistantId}/knowledge-bindings/${bindingId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['assistant-kb-bindings', assistantId] }),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/v1/assistants/${assistantId}/context-preview`, { query: previewQuery.trim() })
        .then((r) => r.data as ContextPreviewResult),
    onSuccess: (data) => setPreview(data),
  });

  const chatMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/v1/assistants/${assistantId}/chat`, {
          query: chatQuery.trim(),
          debug: showSources,
        })
        .then((r) => r.data),
    onSuccess: (data: { answer: string; sources?: ContextPreviewResult['chunks'] }) => {
      setChatAnswer(data.answer);
      setChatSources(data.sources ?? []);
    },
  });

  const availableKbs = knowledgeBases.filter(
    (kb) => !bindings.some((b) => b.knowledgeBaseId === kb.id),
  );

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Режим отладки</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showSources}
              onChange={(e) => onToggleShowSources(e.target.checked)}
            />
            Показывать источники в ответах
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Подключить базу знаний</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <select
            className="flex h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background/50 px-3 text-sm"
            value={kbId}
            onChange={(e) => setKbId(e.target.value)}
          >
            <option value="">Выберите базу знаний</option>
            {availableKbs.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </select>
          <Button disabled={!kbId || addMutation.isPending} onClick={() => addMutation.mutate()}>
            Подключить
          </Button>
        </CardContent>
      </Card>

      {bindings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={BookOpen}
              title="Базы знаний не подключены"
              description="Подключите одну или несколько баз знаний для контекстных ответов"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">База знаний</th>
                <th className="px-4 py-3">Приоритет</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Режим поиска</th>
                <th className="px-4 py-3">Чанков</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bindings.map((b) => (
                <tr key={b.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{b.knowledgeBase?.name ?? b.knowledgeBaseId}</td>
                  <td className="px-4 py-3">{b.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.enabled ? 'success' : 'outline'}>
                      {b.enabled ? 'Активна' : 'Отключена'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{SEARCH_MODE_LABELS[b.searchMode as AssistantSearchMode]}</td>
                  <td className="px-4 py-3">{b.maxChunks}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleMutation.mutate({ bindingId: b.id, enabled: !b.enabled })
                      }
                    >
                      {b.enabled ? 'Выкл' : 'Вкл'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Удалить привязку?')) removeMutation.mutate(b.id);
                      }}
                    >
                      Удалить
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Просмотр контекста
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={previewQuery}
              onChange={(e) => setPreviewQuery(e.target.value)}
              placeholder="Введите вопрос для предпросмотра retrieval…"
            />
            <Button
              disabled={!previewQuery.trim() || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              Просмотр
            </Button>
          </div>
          {preview && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Найдено {preview.chunksFound} · Использовано {preview.chunksUsed} ·{' '}
                {preview.latencyMs} ms
              </p>
              {preview.chunks.map((c) => (
                <div key={c.chunkId} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline">{c.knowledgeBaseName}</Badge>
                    <span className="text-muted-foreground">{c.documentTitle ?? c.documentId}</span>
                    <span className="text-muted-foreground">score={c.score.toFixed(3)}</span>
                  </div>
                  <p className="text-muted-foreground line-clamp-4">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Тестовый чат
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Задайте вопрос ассистенту…"
            />
            <Button
              disabled={!chatQuery.trim() || chatMutation.isPending}
              onClick={() => chatMutation.mutate()}
            >
              Спросить
            </Button>
          </div>
          {chatAnswer && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="whitespace-pre-wrap text-sm">{chatAnswer}</p>
              {showSources && chatSources.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Источники ({chatSources.length} чанков)
                  </p>
                  {chatSources.map((s) => (
                    <div key={s.chunkId} className="text-xs text-muted-foreground">
                      {s.knowledgeBaseName} → {s.documentTitle ?? s.documentId} (score=
                      {s.score.toFixed(3)})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
