import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CLIENT_STATUS_LABELS, type CrmClient } from '@/lib/crm';
import { formatDate } from '@/lib/utils';

export function CrmClientsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: clients = [], isLoading } = useQuery<CrmClient[]>({
    queryKey: ['crm-clients'],
    queryFn: () => api.get('/v1/crm/clients').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/v1/crm/clients', { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-clients'] });
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
          <h1 className="text-2xl font-bold">Клиенты</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Добавить</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя клиента" />
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
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company ?? '—'}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{CLIENT_STATUS_LABELS[c.status]}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/crm/clients/${c.id}`}>Карточка</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
