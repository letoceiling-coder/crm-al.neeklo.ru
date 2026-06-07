import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { PIPELINE_LABELS, type CrmDeal } from '@/lib/crm';
import { formatDate } from '@/lib/utils';

export function CrmDealsPage() {
  const { data: deals = [], isLoading } = useQuery<CrmDeal[]>({
    queryKey: ['crm-deals'],
    queryFn: () => api.get('/v1/crm/deals').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/crm"><ArrowLeft className="h-4 w-4 mr-1" />CRM</Link>
        </Button>
        <h1 className="text-2xl font-bold">Сделки</h1>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Обновлена</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">{d.amount} {d.currency}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{PIPELINE_LABELS[d.status]}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{d.client?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
