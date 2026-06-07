import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import { Layers } from 'lucide-react';
import {
  EMBEDDING_STATUS_LABELS,
  type EmbeddingSummary,
  type KnowledgeChunkListItem,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

interface Props {
  knowledgeBaseId: string;
}

export function KnowledgeChunksTab({ knowledgeBaseId }: Props) {
  const { data: chunks = [], isLoading } = useQuery<KnowledgeChunkListItem[]>({
    queryKey: ['knowledge-chunks', knowledgeBaseId],
    queryFn: () =>
      api
        .get('/v1/knowledge-chunks', { params: { knowledgeBaseId } })
        .then((r) => r.data),
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  if (chunks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AssistantEmptyState
            icon={Layers}
            title="Чанки не созданы"
            description="Чанки появятся после индексации готовых документов"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
            <th className="px-4 py-3">Документ</th>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Символов</th>
            <th className="px-4 py-3">Токенов</th>
            <th className="px-4 py-3">Превью</th>
            <th className="px-4 py-3">Создан</th>
          </tr>
        </thead>
        <tbody>
          {chunks.map((c) => (
            <tr key={c.id} className="border-b border-border/60">
              <td className="px-4 py-3">{c.document?.title ?? c.documentId}</td>
              <td className="px-4 py-3">{c.chunkIndex}</td>
              <td className="px-4 py-3">{c.charCount}</td>
              <td className="px-4 py-3">{c.tokenCount}</td>
              <td className="px-4 py-3 max-w-[240px] truncate text-muted-foreground">{c.content}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KnowledgeEmbeddingsTab({ knowledgeBaseId }: Props) {
  const { data, isLoading } = useQuery<EmbeddingSummary>({
    queryKey: ['knowledge-embeddings-summary', knowledgeBaseId],
    queryFn: () =>
      api
        .get('/v1/knowledge-embeddings/summary', { params: { knowledgeBaseId } })
        .then((r) => r.data),
    refetchInterval: 8000,
  });

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Чанков', data.chunkCount],
          ['Документов indexed', data.indexedDocuments],
          ['Готовых документов', data.totalReadyDocuments],
          ['Модель', data.embeddingProfile?.model ?? '—'],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="pt-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold mt-1 break-words">{String(value)}</dd>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.embeddingProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Профиль эмбеддингов</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Название:</span> {data.embeddingProfile.name}
            </p>
            <p>
              <span className="text-muted-foreground">Провайдер:</span> {data.embeddingProfile.provider}
            </p>
            <p>
              <span className="text-muted-foreground">Размерность:</span> {data.embeddingProfile.dimensions}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3">Документ</th>
              <th className="px-4 py-3">Чанков</th>
              <th className="px-4 py-3">Размер</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Модель</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d) => (
              <tr key={d.id} className="border-b border-border/60">
                <td className="px-4 py-3 font-medium">{d.title ?? d.id}</td>
                <td className="px-4 py-3">{d.chunkCount}</td>
                <td className="px-4 py-3">{d.charCount ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={d.embeddingStatus === 'INDEXED' ? 'success' : 'outline'}>
                    {EMBEDDING_STATUS_LABELS[d.embeddingStatus]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{d.embeddingModel ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
