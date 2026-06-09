import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Link as LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import {
  DOC_FORMAT_LABELS,
  getDocDisplayStatus,
  type KnowledgeDocument,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

interface Props {
  knowledgeBaseId: string;
  documents: KnowledgeDocument[];
}

export function KnowledgeDocumentsTab({ knowledgeBaseId, documents }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [mode, setMode] = useState<'list' | 'url' | 'manual' | 'file'>('list');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['knowledge-base', knowledgeBaseId] });

  const urlMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/knowledge-documents/url', { knowledgeBaseId, url: url.trim() }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['knowledge-jobs'] });
      setUrl('');
      setMode('list');
    },
  });

  const manualMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/knowledge-documents/manual', {
        knowledgeBaseId,
        title: manualTitle.trim(),
        text: manualText.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setManualTitle('');
      setManualText('');
      setMode('list');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('knowledgeBaseId', knowledgeBaseId);
      return api.post('/v1/knowledge-documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: invalidate,
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/knowledge-documents/${id}/reprocess`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['knowledge-jobs'] });
    },
  });

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setMode(mode === 'url' ? 'list' : 'url')}>
          <LinkIcon className="h-4 w-4 mr-1" />
          URL
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          Файл
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode(mode === 'manual' ? 'list' : 'manual')}>
          <FileText className="h-4 w-4 mr-1" />
          Текст
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.zip"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMutation.mutate(f);
            e.target.value = '';
          }}
        />
      </div>

      {mode === 'url' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Добавить по URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            <Button disabled={!url.trim() || urlMutation.isPending} onClick={() => urlMutation.mutate()}>
              {urlMutation.isPending ? 'Постановка в очередь…' : 'Добавить в очередь'}
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Текст вручную</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Текст</Label>
              <Textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={8} className="max-h-96 overflow-y-auto" />
            </div>
            <Button
              disabled={!manualTitle.trim() || manualText.length < 50 || manualMutation.isPending}
              onClick={() => manualMutation.mutate()}
            >
              Сохранить
            </Button>
          </CardContent>
        </Card>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={FileText}
              title="Документы не добавлены"
              description="Загрузите PDF, DOCX, TXT, MD, ZIP, URL или введите текст вручную"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Формат</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Символов</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <>
                <tr key={d.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium break-words max-w-[200px]">{d.title ?? '—'}</td>
                  <td className="px-4 py-3">{DOC_FORMAT_LABELS[d.format]}</td>
                  <td className="px-4 py-3">
                    {(() => { const ds = getDocDisplayStatus(d); return <Badge variant={ds.variant}>{ds.label}</Badge>; })()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {d.category ? (
                      <span title={d.topic?.name}>{d.category.name}{d.topic ? ` / ${d.topic.name}` : ''}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{d.parserChars ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(d.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDocId(selectedDocId === d.id ? null : d.id)}
                      >
                        AI
                      </Button>
                      {d.format !== 'MANUAL' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reprocessMutation.isPending}
                          onClick={() => reprocessMutation.mutate(d.id)}
                        >
                          Перепарсить
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {selectedDocId === d.id && (
                  <tr key={`${d.id}-ai`}>
                    <td colSpan={7} className="bg-muted/30 px-4 py-3">
                      <AiAnalysisPanel documentId={d.id} />
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── AI Analysis inline panel ───────────────────────────────────────────────

function AiAnalysisPanel({ documentId }: { documentId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['doc-ai-analysis', documentId],
    queryFn: () => api.get(`/v1/knowledge-documents/${documentId}/ai-analysis`).then((r) => r.data),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (error || !data) return <p className="text-sm text-destructive">Данные анализа не найдены</p>;

  const summary = (data.summary as Record<string, unknown>) ?? null;
  const cls = (data.classification as Record<string, unknown>) ?? null;
  const pipeline = data.pipeline as {
    status: string;
    qualityScore?: number | null;
    stages?: { stage: string; status: string; errorMessage?: string | null }[];
  } | null;

  return (
    <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
      {/* Summary */}
      {summary && (
        <div>
          <p className="font-semibold mb-1">Краткое содержание</p>
          <p className="text-muted-foreground line-clamp-5">
            {String(summary.summary ?? summary.text ?? summary.content ?? JSON.stringify(summary))}
          </p>
        </div>
      )}

      {/* Classification */}
      {cls && (
        <div>
          <p className="font-semibold mb-1">Классификация</p>
          <p className="text-muted-foreground">
            <span className="font-medium">Категория:</span> {String(cls.category ?? '—')}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium">Тема:</span> {String(cls.topic ?? '—')}
          </p>
          {typeof cls.confidence === 'number' && (
            <p className="text-muted-foreground">
              <span className="font-medium">Уверенность:</span>{' '}
              {Math.round((cls.confidence as number) * 100)}%
            </p>
          )}
        </div>
      )}

      {/* Entities */}
      {Array.isArray(data.entities) && data.entities.length > 0 && (
        <div>
          <p className="font-semibold mb-1">Сущности ({(data.entities as unknown[]).length})</p>
          <div className="flex flex-wrap gap-1">
            {(data.entities as { name: string; entityType: string; confidence?: number }[])
              .slice(0, 12)
              .map((e, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {e.name}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {Array.isArray(data.tags) && data.tags.length > 0 && (
        <div>
          <p className="font-semibold mb-1">Теги</p>
          <div className="flex flex-wrap gap-1">
            {(data.tags as { name: string }[]).map((t, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quality / Pipeline */}
      {pipeline && (
        <div>
          <p className="font-semibold mb-1">Pipeline</p>
          <p className="text-muted-foreground">
            <span className="font-medium">Статус:</span>{' '}
            <span
              className={
                pipeline.status === 'SUCCESS'
                  ? 'text-green-600'
                  : pipeline.status === 'PARTIAL'
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }
            >
              {pipeline.status}
            </span>
          </p>
          {pipeline.qualityScore != null && (
            <p className="text-muted-foreground">
              <span className="font-medium">KQS:</span> {pipeline.qualityScore.toFixed(2)}
            </p>
          )}
          {data.qualityReasons && Array.isArray(data.qualityReasons) && (data.qualityReasons as string[]).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(data.qualityReasons as string[]).map((r, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {r}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
