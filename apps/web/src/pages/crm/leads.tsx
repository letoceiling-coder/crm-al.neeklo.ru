import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PIPELINE_LABELS, type CrmLead } from '@/lib/crm';
import { formatDate } from '@/lib/utils';

export function CrmLeadsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: leads = [], isLoading } = useQuery<CrmLead[]>({
    queryKey: ['crm-leads'],
    queryFn: () => api.get('/v1/crm/leads').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/v1/crm/leads', { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-overview'] });
      setName('');
      setShowCreate(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/crm"><ArrowLeft className="h-4 w-4 mr-1" />CRM</Link>
          </Button>
          <h1 className="text-2xl font-bold">Лиды</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя лида" />
            <Button disabled={!name.trim()} onClick={() => createMutation.mutate()}>Создать</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Имя</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Источник</th>
                <th className="px-4 py-3">Обновлён</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{PIPELINE_LABELS[l.status]}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.source ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
