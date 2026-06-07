import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import { SourceHealthPanel } from '@/components/knowledge/source-health-panel';
import {
  SOURCE_TYPE_LABELS,
  CRAWL_STATUS_LABELS,
  type KnowledgeSource,
  type KnowledgeSourceType,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

const SOURCE_TYPES: KnowledgeSourceType[] = ['URL', 'SITEMAP', 'DOMAIN'];

interface Props {
  knowledgeBaseId: string;
  sources: KnowledgeSource[];
}

export function KnowledgeSourcesTab({ knowledgeBaseId, sources }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<KnowledgeSourceType>('URL');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [view, setView] = useState<'list' | 'health'>('list');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['knowledge-sources', knowledgeBaseId] });
    queryClient.invalidateQueries({ queryKey: ['knowledge-base', knowledgeBaseId] });
    queryClient.invalidateQueries({ queryKey: ['knowledge-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['knowledge-documents', knowledgeBaseId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/knowledge-sources', {
        knowledgeBaseId,
        type,
        url: url.trim(),
        sitemapUrl: type === 'SITEMAP' ? url.trim() : undefined,
        name: name.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setUrl('');
      setName('');
    },
  });

  const crawlMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/knowledge-sources/${id}/crawl`),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить источник
          </Button>
        )}
        {sources.length > 0 && (
          <>
            <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
              Список
            </Button>
            <Button variant={view === 'health' ? 'default' : 'outline'} size="sm" onClick={() => setView('health')}>
              Здоровье источника
            </Button>
          </>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новый источник</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Тип</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm max-w-xs"
                value={type}
                onChange={(e) => setType(e.target.value as KnowledgeSourceType)}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SOURCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button disabled={!url.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Постановка в очередь…' : 'Добавить'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sources.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={Globe}
              title="Источники не добавлены"
              description="Добавьте URL, Sitemap или домен для автоматического сбора документов"
            />
          </CardContent>
        </Card>
      ) : view === 'health' ? (
        <div className="space-y-3">
          {sources.map((s) => (
            <SourceHealthPanel key={s.id} source={s} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Успешность</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name ?? s.url ?? '—'}</div>
                    {s.domain && <code className="text-xs text-muted-foreground">{s.domain}</code>}
                  </td>
                  <td className="px-4 py-3">{SOURCE_TYPE_LABELS[s.type]}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{CRAWL_STATUS_LABELS[s.crawlStatus]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.successRate != null ? `${Math.round(s.successRate * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {s.lastParsedAt ? formatDate(s.lastParsedAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={crawlMutation.isPending}
                      onClick={() => crawlMutation.mutate(s.id)}
                    >
                      Обновить источник
                    </Button>
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
