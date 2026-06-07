import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

export function AdminPricingPage() {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['key-model-profiles'],
    queryFn: () => api.get('/key-model-profiles').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Тарифы</h1>
          <p className="text-muted-foreground">
            Профили моделей и цены за 1M токенов для API-ключей
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/key-models">
            <Layers className="h-4 w-4" />
            Редактировать профили
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Профили (auto / aura / neeklo)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 font-medium">Название</th>
                <th className="pb-3 font-medium">Slug (model в API)</th>
                <th className="pb-3 font-medium">₽ / 1M токенов</th>
                <th className="pb-3 font-medium">Моделей в цепочке</th>
                <th className="pb-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : (
                (profiles ?? []).map(
                  (p: {
                    id: string;
                    name: string;
                    slug: string;
                    pricePerMillionRub: number;
                    isActive: boolean;
                    modelChain?: unknown[];
                  }) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-3 font-medium">{p.name}</td>
                      <td className="py-3 font-mono text-xs">{p.slug}</td>
                      <td className="py-3">{formatCurrency(Number(p.pricePerMillionRub))}</td>
                      <td className="py-3">{p.modelChain?.length ?? 0}</td>
                      <td className="py-3">
                        <Badge variant={p.isActive ? 'success' : 'outline'}>
                          {p.isActive ? 'Активен' : 'Выкл'}
                        </Badge>
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Тариф применяется при выборе <code>model</code> в запросе или профиля, привязанного к ключу.
        Себестоимость OpenRouter — в разделе Usage и Аналитика.
      </p>
    </div>
  );
}
