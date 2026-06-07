import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KB_STATUS_LABELS, type KnowledgeBaseStatus } from '@/lib/knowledge';

const STATUSES: KnowledgeBaseStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export function KnowledgeCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<KnowledgeBaseStatus>('DRAFT');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/knowledge-bases', {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      }),
    onSuccess: (res) => navigate(`/knowledge/${res.data.id}`),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/knowledge">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Создание базы знаний</h1>
          <p className="text-muted-foreground">Настройте контейнер для документов и источников</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Параметры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="База знаний компании" />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm max-w-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value as KnowledgeBaseStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {KB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Создание…' : 'Создать'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
