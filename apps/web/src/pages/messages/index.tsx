import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CHANNEL_LABELS, type Conversation } from '@/lib/integrations';
import { formatDate } from '@/lib/utils';

export function MessagesInboxPage() {
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/v1/integrations/conversations').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-7 w-7" />
          Сообщения
        </h1>
        <p className="text-muted-foreground">Единый inbox по всем каналам</p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : conversations.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Нет диалогов</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => {
            const last = c.messages?.[0];
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className="block rounded-xl border border-border px-4 py-3 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline">{CHANNEL_LABELS[c.channel]}</Badge>
                  {c.assistant && <span className="text-sm">{c.assistant.name}</span>}
                  <Badge variant="outline">{c.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.lastMessageAt ? formatDate(c.lastMessageAt) : '—'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{last?.content ?? '—'}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
