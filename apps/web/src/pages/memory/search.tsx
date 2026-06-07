import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  SEARCH_MODE_LABELS,
  ENTRY_TYPE_LABELS,
  type MemorySearchHit,
  type MemorySearchMode,
  type MemorySearchLog,
} from '@/lib/memory';

export function MemorySearchPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<MemorySearchMode>('HYBRID');
  const [profileId, setProfileId] = useState('');
  const [hits, setHits] = useState<MemorySearchHit[]>([]);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);

  const { data: logs = [] } = useQuery<MemorySearchLog[]>({
    queryKey: ['memory-search-logs'],
    queryFn: () => api.get('/v1/memory/search-logs').then((r) => r.data),
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/memory/search', {
        query: query.trim(),
        mode,
        profileId: profileId.trim() || undefined,
        limit: 10,
        debug: true,
      }),
    onSuccess: (res) => {
      setHits(res.data.hits ?? []);
      setDebug(res.data.debug ?? null);
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/memory"><ArrowLeft className="h-4 w-4 mr-1" />Память</Link>
        </Button>
        <h1 className="text-2xl font-bold">Поиск по памяти</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Запрос..." />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as MemorySearchMode)}
            >
              {(Object.keys(SEARCH_MODE_LABELS) as MemorySearchMode[]).map((m) => (
                <option key={m} value={m}>{SEARCH_MODE_LABELS[m]}</option>
              ))}
            </select>
            <Input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="profileId (опционально)"
            />
          </div>
          <Button disabled={!query.trim()} onClick={() => searchMutation.mutate()}>
            Искать
          </Button>
        </CardContent>
      </Card>

      {debug && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <strong className="text-foreground">Debug:</strong>{' '}
            keyword={String(debug.keywordCount ?? 0)}, vector={String(debug.vectorCount ?? 0)}
          </CardContent>
        </Card>
      )}

      {hits.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Результаты</h2>
          {hits.map((h) => (
            <Card key={h.entryId}>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2 mb-2 text-xs">
                  <Badge variant="outline">{ENTRY_TYPE_LABELS[h.entryType as keyof typeof ENTRY_TYPE_LABELS] ?? h.entryType}</Badge>
                  <span className="text-muted-foreground">score {h.score.toFixed(3)}</span>
                  {h.reason && <span className="text-primary">{h.reason}</span>}
                </div>
                <p className="text-sm">{h.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">История поиска</h2>
            <div className="space-y-2 text-sm">
              {logs.slice(0, 10).map((l) => (
                <div key={l.id} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="truncate">{l.query}</span>
                  <span className="text-muted-foreground shrink-0">{l.resultCount} · {l.latencyMs}ms</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
