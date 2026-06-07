import { cn } from '@/lib/utils';
import type { ReadinessResult } from '@/lib/assistant-readiness';

interface Props {
  readiness: ReadinessResult;
}

export function AssistantReadinessCard({ readiness }: Props) {
  const barColor =
    readiness.percent >= 100
      ? 'bg-success'
      : readiness.percent >= 60
        ? 'bg-warning'
        : 'bg-muted-foreground/50';

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Статус настройки</h2>
          <p className="text-lg font-semibold">{readiness.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{readiness.description}</p>
        </div>
        <div className="text-3xl font-bold tabular-nums">{readiness.percent}%</div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-4">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${readiness.percent}%` }}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 text-sm">
        {readiness.checks.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                c.done ? 'bg-success' : c.optional ? 'bg-muted-foreground/40' : 'bg-destructive/60',
              )}
            />
            <span className={c.done ? 'text-foreground' : 'text-muted-foreground'}>
              {c.label}
              {c.optional ? ' (необязательно)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
