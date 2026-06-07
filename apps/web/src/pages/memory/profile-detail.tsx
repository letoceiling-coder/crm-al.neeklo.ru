import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ENTITY_TYPE_LABELS,
  ENTRY_TYPE_LABELS,
  type MemoryProfile,
  type MemoryEntry,
  type MemoryEntryType,
} from '@/lib/memory';
import { formatDate } from '@/lib/utils';

export function MemoryProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<MemoryEntryType>('FACT');

  const { data: profile, isLoading } = useQuery<MemoryProfile>({
    queryKey: ['memory-profile', id],
    queryFn: () => api.get(`/v1/memory/profiles/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const { data: entries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ['memory-entries', id],
    queryFn: () => api.get(`/v1/memory/profiles/${id}/entries`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/memory/profiles/${id}/entries`, { content: content.trim(), entryType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-entries', id] });
      qc.invalidateQueries({ queryKey: ['memory-profile', id] });
      setContent('');
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: () => api.post(`/v1/memory/profiles/${id}/summarize`, { period: 'rolling-7d' }),
  });

  if (isLoading || !profile) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/memory/profiles"><ArrowLeft className="h-4 w-4 mr-1" />Профили</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ENTITY_TYPE_LABELS[profile.entityType]} · {profile._count?.entries ?? 0} записей
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => summarizeMutation.mutate()} disabled={summarizeMutation.isPending}>
          <Sparkles className="h-4 w-4 mr-2" />
          Суммаризация
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Новая запись</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as MemoryEntryType)}
          >
            {(Object.keys(ENTRY_TYPE_LABELS) as MemoryEntryType[]).map((t) => (
              <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Содержание памяти..." rows={4} />
          <Button disabled={!content.trim()} onClick={() => addMutation.mutate()}>
            <Plus className="h-4 w-4 mr-2" />Добавить
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{ENTRY_TYPE_LABELS[e.entryType]}</Badge>
                <span className="text-xs text-muted-foreground">важность {e.importance}</span>
                {e.source && <span className="text-xs text-muted-foreground">· {e.source}</span>}
                <span className="text-xs text-muted-foreground ml-auto">{formatDate(e.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{e.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {profile.summaries && profile.summaries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Сводки</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {profile.summaries.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-2">
                  {s.period} · {s.entryCount} записей · {formatDate(s.createdAt)}
                </div>
                <pre className="whitespace-pre-wrap font-sans">{s.summary.slice(0, 500)}...</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
