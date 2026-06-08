import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Archive } from 'lucide-react';
import { marketplaceApi, PACKAGE_TYPE_LABELS, VISIBILITY_LABELS } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export function MarketplaceMyPage() {
  const queryClient = useQueryClient();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['marketplace-my'],
    queryFn: () => marketplaceApi.listPackages({ mine: 'true' }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => marketplaceApi.unpublish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-my'] }),
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/marketplace">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Marketplace
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Мои пакеты</h1>
          <p className="text-muted-foreground">Опубликованные и черновики вашей организации</p>
        </div>
        <Button asChild>
          <Link to="/marketplace/publish">Новый пакет</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            У вас пока нет пакетов
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Видимость</th>
                <th className="px-4 py-3">Установок</th>
                <th className="px-4 py-3">Обновлён</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <Link to={`/marketplace/package/${pkg.id}`} className="font-medium hover:text-primary">
                      {pkg.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">v{pkg.version}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{PACKAGE_TYPE_LABELS[pkg.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">{pkg.status}</td>
                  <td className="px-4 py-3">{VISIBILITY_LABELS[pkg.visibility]}</td>
                  <td className="px-4 py-3">{pkg.installs}</td>
                  <td className="px-4 py-3">{formatDate(pkg.updatedAt)}</td>
                  <td className="px-4 py-3">
                    {pkg.status === 'PUBLISHED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unpublishMutation.mutate(pkg.id)}
                        disabled={unpublishMutation.isPending}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
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
