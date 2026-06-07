import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CHANNEL_LABELS, type Conversation } from '@/lib/integrations';
import { formatDate } from '@/lib/utils';

export function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');

  const { data: conversation, isLoading } = useQuery<Conversation>({
    queryKey: ['conversation', id],
    queryFn: () => api.get(`/v1/integrations/conversations/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/v1/integrations/conversations/${id}/messages`, { content: reply.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      setReply('');
    },
  });

  if (isLoading || !conversation) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/messages"><ArrowLeft className="h-4 w-4 mr-1" />Сообщения</Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{CHANNEL_LABELS[conversation.channel]} · {conversation.externalId}</h1>
          {conversation.assistant && (
            <p className="text-sm text-muted-foreground">Ассистент: {conversation.assistant.name}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(conversation.messages ?? []).map((m) => (
          <Card key={m.id} className={m.direction === 'OUTBOUND' ? 'border-primary/30' : ''}>
            <CardContent className="pt-4">
              <div className="flex gap-2 mb-2 text-xs">
                <Badge variant="outline">{m.direction}</Badge>
                <span className="text-muted-foreground">{formatDate(m.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ответ..." />
        <Button disabled={!reply.trim()} onClick={() => sendMutation.mutate()}>Отправить</Button>
      </div>
    </div>
  );
}
