import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  PROVIDER_LABELS,
  type IntegrationAccount,
  type AssistantChannel,
} from '@/lib/integrations';

interface AssistantChannelsTabProps {
  assistantId: string;
}

export function AssistantChannelsTab({ assistantId }: AssistantChannelsTabProps) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');

  const { data: channels = [] } = useQuery<AssistantChannel[]>({
    queryKey: ['assistant-channels', assistantId],
    queryFn: () => api.get(`/v1/integrations/assistants/${assistantId}/channels`).then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<IntegrationAccount[]>({
    queryKey: ['integration-accounts'],
    queryFn: () => api.get('/v1/integrations/accounts').then((r) => r.data),
  });

  const bindMutation = useMutation({
    mutationFn: () =>
      api.post(`/v1/integrations/assistants/${assistantId}/channels`, {
        integrationAccountId: accountId,
        settings: { autoReply: true },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant-channels', assistantId] });
      setAccountId('');
    },
  });

  const available = accounts.filter(
    (a) => !channels.some((c) => c.integrationAccount.id === a.id),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Привяжите Telegram, MAX, Email или Webhook аккаунты к ассистенту.
          </p>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Выберите аккаунт</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({PROVIDER_LABELS[a.provider]})</option>
            ))}
          </select>
          <Button disabled={!accountId} onClick={() => bindMutation.mutate()}>Привязать канал</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {channels.map((ch) => (
          <div key={ch.id} className="rounded-lg border px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{ch.integrationAccount.name}</div>
              <div className="text-xs text-muted-foreground">
                {PROVIDER_LABELS[ch.integrationAccount.provider]}
              </div>
            </div>
            <Badge variant={ch.enabled ? 'success' : 'outline'}>{ch.enabled ? 'Активен' : 'Выкл'}</Badge>
          </div>
        ))}
        {channels.length === 0 && (
          <p className="text-sm text-muted-foreground">Каналы не привязаны.</p>
        )}
      </div>
    </div>
  );
}
