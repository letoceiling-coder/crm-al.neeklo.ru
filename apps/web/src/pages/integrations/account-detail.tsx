import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PROVIDER_LABELS, STATUS_LABELS, type IntegrationAccount } from '@/lib/integrations';

export function IntegrationAccountDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: account, isLoading } = useQuery<IntegrationAccount & { channels?: unknown[] }>({
    queryKey: ['integration-account', id],
    queryFn: () => api.get(`/v1/integrations/accounts/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  if (isLoading || !account) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  const webhookBase = typeof window !== 'undefined'
    ? `${window.location.origin.replace(':5173', ':3000')}/api/v1/integrations`
    : '';
  const webhookPath =
    account.provider === 'TELEGRAM'
      ? `${webhookBase}/telegram/webhook/${account.id}`
      : account.provider === 'MAX'
        ? `${webhookBase}/max/webhook/${account.id}`
        : account.provider === 'EMAIL'
          ? `${webhookBase}/email/webhook/${account.id}`
          : `${webhookBase}/webhook/inbound/${account.id}`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/integrations"><ArrowLeft className="h-4 w-4 mr-1" />Интеграции</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-sm text-muted-foreground">{PROVIDER_LABELS[account.provider]}</p>
        </div>
      </div>

      <Badge variant={account.status === 'ACTIVE' ? 'success' : 'outline'}>{STATUS_LABELS[account.status]}</Badge>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Webhook URL</div>
            <div className="flex gap-2">
              <code className="text-xs break-all flex-1 rounded bg-muted p-2">{webhookPath}</code>
              <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(webhookPath)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {account.webhookSecret && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Signature secret (X-Signature: sha256=...)</div>
              <code className="text-xs break-all block rounded bg-muted p-2">{account.webhookSecret}</code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
