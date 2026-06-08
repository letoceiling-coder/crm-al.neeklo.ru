import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import {
  CRAWL_STATUS_LABELS,
  SOURCE_STATUS_LABELS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  type KnowledgeSource,
  type SourceHealth,
} from '@/lib/knowledge';
import { formatDate } from '@/lib/utils';

interface Props {
  source: KnowledgeSource;
}

export function SourceHealthPanel({ source }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: health, isLoading } = useQuery<SourceHealth>({
    queryKey: ['knowledge-source-health', source.id],
    queryFn: () => api.get(`/v1/knowledge-sources/${source.id}/health`).then((r) => r.data),
    enabled: expanded,
  });

  const crawlMutation = useMutation({
    mutationFn: () => api.post(`/v1/knowledge-sources/${source.id}/crawl`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-source-health', source.id] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-jobs'] });
    },
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium truncate">
            {source.name ?? source.url ?? source.id}
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline">{SOURCE_TYPE_LABELS[source.type]}</Badge>
            <Badge variant="outline">
              {health?.source.status
                ? SOURCE_STATUS_LABELS[health.source.status]
                : CRAWL_STATUS_LABELS[source.crawlStatus]}
            </Badge>
            {health?.source.progress != null && health.source.progress > 0 && (
              <Badge variant="outline">{health.source.progress}%</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            <Activity className="h-4 w-4 mr-1" />
            {expanded ? 'Скрыть' : 'Здоровье'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={crawlMutation.isPending}
            onClick={() => crawlMutation.mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Обновить
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          ) : !health ? (
            <AssistantEmptyState icon={Activity} title="Нет данных" description="" />
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {[
                  ['Статус', health.source.status ? SOURCE_STATUS_LABELS[health.source.status] : '—'],
                  ['Прогресс', `${health.source.progress ?? 0}%`],
                  ['Последний запуск', health.source.lastRunAt ? formatDate(health.source.lastRunAt) : '—'],
                  [
                    'Последний успех',
                    health.source.lastSuccessAt
                      ? formatDate(health.source.lastSuccessAt)
                      : health.source.lastParsedAt
                        ? formatDate(health.source.lastParsedAt)
                        : '—',
                  ],
                  [
                    'Успешность',
                    health.source.successRate != null
                      ? `${Math.round(health.source.successRate * 100)}%`
                      : '—',
                  ],
                  ['Средний размер', health.source.averageChars ?? health.domainProfile?.averageChars ?? '—'],
                  ['Последняя ошибка', health.source.lastError ?? '—'],
                  ['Парсер', health.source.parserMode ?? 'parser-html-site'],
                  ['Качество', health.source.qualityScore ?? '—'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border p-3">
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="font-medium mt-0.5 break-words">{String(value)}</dd>
                  </div>
                ))}
              </dl>

              {health.domainProfile && (
                <div className="text-xs text-muted-foreground rounded-lg border border-border p-3">
                  Профиль домена {health.domainProfile.domain}: рекомендуемый режим{' '}
                  <strong>{health.domainProfile.recommendedMode ?? 'STANDARD'}</strong>
                  {health.domainProfile.captchaDetected && ' · CAPTCHA'}
                  {health.domainProfile.antiBotDetected && ' · Anti-bot'}
                </div>
              )}

              {health.recentJobs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Последние задачи</h4>
                  <ul className="space-y-1 text-xs">
                    {health.recentJobs.map((j) => (
                      <li key={j.id} className="flex justify-between gap-2 border-b border-border/40 py-1">
                        <span>
                          {JOB_TYPE_LABELS[j.type]} — {JOB_STATUS_LABELS[j.status]}
                        </span>
                        <span className="text-muted-foreground">{formatDate(j.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
