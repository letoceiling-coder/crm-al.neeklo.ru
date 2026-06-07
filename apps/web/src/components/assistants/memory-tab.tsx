import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea, Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ENTRY_TYPE_LABELS,
  type MemoryEntry,
  type MemoryEntryType,
  type MemoryProfile,
} from '@/lib/memory';
import { formatDate } from '@/lib/utils';

interface AssistantMemoryTabProps {
  assistantId: string;
  assistantName: string;
}

export function AssistantMemoryTab({ assistantId, assistantName }: AssistantMemoryTabProps) {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<MemoryEntryType>('FACT');

  const { data: profile, isLoading: profileLoading } = useQuery<MemoryProfile>({
    queryKey: ['assistant-memory-profile', assistantId],
    queryFn: () =>
      api
        .post('/v1/memory/profiles/get-or-create', {
          entityType: 'ASSISTANT',
          entityId: assistantId,
          name: `Память: ${assistantName}`,
        })
        .then((r) => r.data),
  });

  const profileId = profile?.id;

  const { data: entries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ['memory-entries', profileId],
    queryFn: () => api.get(`/v1/memory/profiles/${profileId}/entries`).then((r) => r.data),
    enabled: Boolean(profileId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/memory/profiles/${profileId}/entries`, {
        content: content.trim(),
        entryType,
        source: 'assistant-ui',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-entries', profileId] });
      setContent('');
    },
  });

  if (profileLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Долговременная память</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Факты и правила, которые ассистент использует при каждом ответе (не путать с историей чата).
          </p>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as MemoryEntryType)}
          >
            {(Object.keys(ENTRY_TYPE_LABELS) as MemoryEntryType[]).map((t) => (
              <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Например: Компания называется Acme. Основной продукт — CRM."
            rows={3}
          />
          <Button disabled={!content.trim() || !profileId} onClick={() => addMutation.mutate()}>
            <Plus className="h-4 w-4 mr-2" />Сохранить в память
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-border p-3">
            <div className="flex gap-2 mb-1 text-xs">
              <Badge variant="outline">{ENTRY_TYPE_LABELS[e.entryType]}</Badge>
              <span className="text-muted-foreground">{formatDate(e.createdAt)}</span>
            </div>
            <p className="text-sm">{e.content}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Память пуста. Добавьте факты о компании, клиентах или правила.</p>
        )}
      </div>
    </div>
  );
}
