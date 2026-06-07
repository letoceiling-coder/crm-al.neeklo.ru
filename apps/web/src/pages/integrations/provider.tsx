import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PROVIDER_LABELS, type IntegrationProviderType, type IntegrationProvider } from '@/lib/integrations';

export function IntegrationProviderPage() {
  const { provider } = useParams<{ provider: string }>();
  const providerType = provider?.toUpperCase() as IntegrationProviderType;
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');

  const { data: providerInfo } = useQuery<IntegrationProvider>({
    queryKey: ['integration-provider', providerType],
    queryFn: () => api.get(`/v1/integrations/providers/${providerType}`).then((r) => r.data),
    enabled: Boolean(providerType),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/v1/integrations/accounts', {
        provider: providerType,
        name: name.trim(),
        secret: secret.trim() || undefined,
        settings: {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-accounts'] });
      setName('');
      setSecret('');
    },
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/integrations"><ArrowLeft className="h-4 w-4 mr-1" />Интеграции</Link>
        </Button>
        <h1 className="text-2xl font-bold">{PROVIDER_LABELS[providerType] ?? provider}</h1>
      </div>

      {providerInfo?.description && (
        <p className="text-muted-foreground">{providerInfo.description}</p>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название аккаунта" />
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Bot token / API key / secret"
            type="password"
          />
          <Button disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Подключить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
