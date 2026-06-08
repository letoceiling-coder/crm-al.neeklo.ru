import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { systemApi } from '@/lib/system';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function SystemPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/system"><ArrowLeft className="h-4 w-4 mr-2" />Система</Link>
      </Button>
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function SystemMetricsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['system-metrics'], queryFn: () => systemApi.getMetrics() });
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  return (
    <SystemPageShell title="Мониторинг">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Heap MB</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.memory?.heapUsedMb}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Organizations</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.postgresql?.organizations}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Assistants</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.postgresql?.assistants}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">KB Chunks</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.postgresql?.knowledgeChunks}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Cache stats</CardTitle></CardHeader>
        <CardContent><pre className="text-xs overflow-auto">{JSON.stringify(data?.cache, null, 2)}</pre></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Full metrics</CardTitle></CardHeader>
        <CardContent><pre className="text-xs overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre></CardContent>
      </Card>
    </SystemPageShell>
  );
}

export function SystemQueuesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['system-queues'], queryFn: () => systemApi.getQueues() });
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  return (
    <SystemPageShell title="Очереди">
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Queue</th><th>Waiting</th><th>Active</th><th>Failed</th><th>Lag ms</th><th>Health</th>
                </tr>
              </thead>
              <tbody>
                {(data?.queues ?? []).map((q: { name: string; waiting: number; active: number; failed: number; lagMs: number | null; health: string }) => (
                  <tr key={q.name} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs">{q.name}</td>
                    <td>{q.waiting}</td><td>{q.active}</td><td>{q.failed}</td>
                    <td>{q.lagMs ?? '—'}</td><td>{q.health}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </SystemPageShell>
  );
}

export function SystemHealthPage() {
  const { data } = useQuery({ queryKey: ['system-health'], queryFn: () => systemApi.getHealth() });
  return (
    <SystemPageShell title="Health">
      <Card><CardContent className="pt-6"><pre className="text-xs">{JSON.stringify(data, null, 2)}</pre></CardContent></Card>
    </SystemPageShell>
  );
}

export function SystemDependenciesPage() {
  const { data } = useQuery({ queryKey: ['system-deps'], queryFn: () => systemApi.getDependencies() });
  return (
    <SystemPageShell title="Зависимости">
      <Card><CardContent className="pt-6"><pre className="text-xs">{JSON.stringify(data, null, 2)}</pre></CardContent></Card>
    </SystemPageShell>
  );
}

export function SystemSecurityPage() {
  const { data } = useQuery({ queryKey: ['system-security'], queryFn: () => systemApi.getSecurity() });
  const { data: anomalies } = useQuery({ queryKey: ['system-cost-anomalies'], queryFn: () => systemApi.getCostAnomalies() });
  return (
    <SystemPageShell title="Безопасность">
      <Card><CardHeader><CardTitle>Security diagnostics</CardTitle></CardHeader><CardContent><pre className="text-xs">{JSON.stringify(data, null, 2)}</pre></CardContent></Card>
      <Card><CardHeader><CardTitle>Cost anomalies</CardTitle></CardHeader><CardContent><pre className="text-xs">{JSON.stringify(anomalies, null, 2)}</pre></CardContent></Card>
    </SystemPageShell>
  );
}
