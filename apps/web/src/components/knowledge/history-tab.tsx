import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, AlertCircle, Zap, Layers, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import {
  HISTORY_EVENT_LABELS,
  type KnowledgeHistoryEvent,
  type KnowledgeHistoryEventType,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

interface Props {
  knowledgeBaseId: string;
}

const EVENT_ICONS: Partial<Record<KnowledgeHistoryEventType, React.ElementType>> = {
  INGEST_COMPLETED: CheckCircle,
  INGEST_FAILED: XCircle,
  INGEST_SKIPPED: AlertCircle,
  ENRICHMENT_STARTED: Zap,
  ENRICHMENT_COMPLETED: Zap,
  ENRICHMENT_FAILED: XCircle,
  CHUNKING_COMPLETED: Layers,
  EMBEDDING_COMPLETED: Layers,
  DOCUMENT_CREATED: FileText,
  DOCUMENT_DELETED: FileText,
  ERROR: AlertCircle,
};

const EVENT_COLORS: Partial<Record<KnowledgeHistoryEventType, string>> = {
  INGEST_COMPLETED: 'text-green-600',
  ENRICHMENT_COMPLETED: 'text-green-600',
  CHUNKING_COMPLETED: 'text-blue-600',
  EMBEDDING_COMPLETED: 'text-blue-600',
  INGEST_FAILED: 'text-red-500',
  ENRICHMENT_FAILED: 'text-red-500',
  ERROR: 'text-red-500',
  INGEST_SKIPPED: 'text-yellow-600',
};

export function KnowledgeHistoryTab({ knowledgeBaseId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-history', knowledgeBaseId],
    queryFn: () =>
      api
        .get('/v1/knowledge-history', { params: { knowledgeBaseId, limit: 100 } })
        .then((r) => r.data as { total: number; events: KnowledgeHistoryEvent[] }),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Загрузка истории…</p>;
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AssistantEmptyState
            icon={Clock}
            title="История пуста"
            description="События появятся после загрузки и обработки документов"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Показано {events.length} из {data?.total ?? 0} событий
      </p>
      <div className="space-y-1">
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.eventType] ?? Clock;
          const color = EVENT_COLORS[event.eventType] ?? 'text-muted-foreground';
          return (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {HISTORY_EVENT_LABELS[event.eventType] ?? event.eventType}
                  </span>
                  {event.document && (
                    <Badge variant="outline" className="text-xs font-normal truncate max-w-[160px]">
                      {event.document.title ?? event.document.id}
                    </Badge>
                  )}
                </div>
                {event.data && Object.keys(event.data).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {Object.entries(event.data)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <time className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {formatDate(event.createdAt)}
              </time>
            </div>
          );
        })}
      </div>
    </div>
  );
}
