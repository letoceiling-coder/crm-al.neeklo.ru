import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Star } from 'lucide-react';
import { marketplaceApi, PACKAGE_TYPE_LABELS, VISIBILITY_LABELS } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export function MarketplacePackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: pkg, isLoading } = useQuery({
    queryKey: ['marketplace-package', id],
    queryFn: () => marketplaceApi.getPackage(id!),
    enabled: Boolean(id),
  });

  const installMutation = useMutation({
    mutationFn: () => marketplaceApi.install(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-package', id] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-installed'] });
    },
  });

  if (isLoading || !pkg) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const latestVersion = pkg.versions?.[0];

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/marketplace">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Marketplace
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{pkg.name}</h1>
            {pkg.isVerified && <Badge variant="success">Verified</Badge>}
            {pkg.isFeatured && <Badge variant="success">Featured</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{PACKAGE_TYPE_LABELS[pkg.type]}</Badge>
            <Badge variant="outline">{VISIBILITY_LABELS[pkg.visibility]}</Badge>
            <span>v{pkg.version}</span>
          </div>
          {pkg.organization && (
            <p className="text-sm text-muted-foreground">
              Автор: {pkg.author?.name || pkg.author?.email} · {pkg.organization.name}
            </p>
          )}
        </div>
        <Button
          onClick={() => installMutation.mutate()}
          disabled={installMutation.isPending || pkg.status !== 'PUBLISHED'}
        >
          <Download className="h-4 w-4 mr-2" />
          {installMutation.isPending ? 'Установка…' : 'Установить'}
        </Button>
      </div>

      {installMutation.isSuccess && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 text-sm">
            Пакет установлен. Локальная копия создана в вашей организации.
          </CardContent>
        </Card>
      )}

      {installMutation.isError && (
        <Card className="border-destructive/30">
          <CardContent className="py-4 text-sm text-destructive">
            Ошибка установки. Возможно, пакет уже установлен.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Описание</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground whitespace-pre-wrap">
          {pkg.description || 'Описание не указано'}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{pkg.installs}</div>
            <div className="text-sm text-muted-foreground">Установок</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Star className="h-5 w-5" />
              {pkg.rating.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">{pkg.ratingCount} отзывов</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{pkg.downloads}</div>
            <div className="text-sm text-muted-foreground">Просмотров</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Версии</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(pkg.versions ?? []).map((v) => (
            <div key={v.id} className="flex justify-between border-b border-border/60 pb-2 text-sm">
              <span className="font-medium">v{v.version}</span>
              <span className="text-muted-foreground">
                {v.publishedAt ? formatDate(v.publishedAt) : 'Черновик'}
              </span>
            </div>
          ))}
          {!pkg.versions?.length && (
            <p className="text-sm text-muted-foreground">Нет опубликованных версий</p>
          )}
        </CardContent>
      </Card>

      {latestVersion?.manifest && (
        <Card>
          <CardHeader>
            <CardTitle>Состав пакета</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto rounded-lg bg-muted p-4 max-h-64">
              {JSON.stringify(latestVersion.manifest, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Отзывы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(pkg.reviews ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Отзывов пока нет</p>
          ) : (
            pkg.reviews!.map((r) => (
              <div key={r.id} className="border-b border-border/60 pb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.organization?.name}</span>
                  <span className="text-yellow-500">{'★'.repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-muted-foreground mt-1">{r.comment}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Обновлено: {formatDate(pkg.updatedAt)}
      </p>
    </div>
  );
}
