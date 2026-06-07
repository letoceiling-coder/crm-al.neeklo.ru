import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Link as LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import {
  DOC_STATUS_LABELS,
  DOC_FORMAT_LABELS,
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

  const statusVariant = (s: string) => {
    if (s === 'READY') return 'success' as const;
    if (s === 'FAILED' || s === 'SKIPPED_QUALITY') return 'destructive' as const;
    return 'outline' as const;
  };

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
                <th className="px-4 py-3">Версия</th>
                <th className="px-4 py-3">Символов</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium break-words max-w-[200px]">{d.title ?? '—'}</td>
                  <td className="px-4 py-3">{DOC_FORMAT_LABELS[d.format]}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(d.status)}>{DOC_STATUS_LABELS[d.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">{d.currentVersion || '—'}</td>
                  <td className="px-4 py-3">{d.parserChars ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(d.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
