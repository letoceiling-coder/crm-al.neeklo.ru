import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ENTITY_TYPE_LABELS, type MemoryProfile, type MemoryProfileEntityType } from '@/lib/memory';
import { formatDate } from '@/lib/utils';

const ENTITY_TYPES: MemoryProfileEntityType[] = [
  'ORGANIZATION',
  'ASSISTANT',
  'CLIENT',
  'USER',
  'WORKFLOW',
];

export function MemoryProfilesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<MemoryProfileEntityType>('ORGANIZATION');
  const [entityId, setEntityId] = useState('');

  const { data: profiles = [], isLoading } = useQuery<MemoryProfile[]>({
    queryKey: ['memory-profiles'],
    queryFn: () => api.get('/v1/memory/profiles').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/memory/profiles', {
        name: name.trim(),
        entityType,
        entityId: entityId.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memory-profiles'] });
      setShowCreate(false);
      setName('');
      setEntityId('');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/memory"><ArrowLeft className="h-4 w-4 mr-1" />Память</Link>
          </Button>
          <h1 className="text-2xl font-bold">Профили памяти</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Создать</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6 grid gap-3 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as MemoryProfileEntityType)}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="ID сущности (assistantId, clientId, orgId...)"
            />
            <Button
              className="sm:col-span-2"
              disabled={!name.trim() || !entityId.trim()}
              onClick={() => createMutation.mutate()}
            >
              Создать профиль
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Записей</th>
                <th className="px-4 py-3">Обновлён</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <Link to={`/memory/profiles/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline">{ENTITY_TYPE_LABELS[p.entityType]}</Badge></td>
                  <td className="px-4 py-3">{p._count?.entries ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
