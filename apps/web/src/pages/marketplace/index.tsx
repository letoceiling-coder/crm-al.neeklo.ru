import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Star, Download } from 'lucide-react';
import { marketplaceApi, PACKAGE_TYPE_LABELS, type MarketplacePackage } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function PackageCard({ pkg }: { pkg: MarketplacePackage }) {
  return (
    <Link to={`/marketplace/package/${pkg.id}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">{pkg.name}</CardTitle>
            {pkg.isFeatured && <Badge variant="success">Featured</Badge>}
          </div>
          <Badge variant="outline">{PACKAGE_TYPE_LABELS[pkg.type]}</Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="line-clamp-2 min-h-[2.5rem]">{pkg.description || 'Без описания'}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {pkg.rating.toFixed(1)} ({pkg.ratingCount})
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {pkg.installs} установок
            </span>
            <span>v{pkg.version}</span>
          </div>
          {pkg.category && (
            <Badge variant="outline" className="text-xs">
              {pkg.category.name}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: MarketplacePackage[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </section>
  );
}

export function MarketplacePage() {
  const { data: featured, isLoading: loadingFeatured } = useQuery({
    queryKey: ['marketplace-featured'],
    queryFn: () => marketplaceApi.getFeatured(8),
  });

  const { data: packages = [], isLoading: loadingAll } = useQuery({
    queryKey: ['marketplace-packages'],
    queryFn: () => marketplaceApi.listPackages(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: () => marketplaceApi.listCategories(),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" />
            Marketplace
          </h1>
          <p className="text-muted-foreground">
            Публикация и установка ассистентов, workflow, инструментов и баз знаний
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/marketplace/installed">Установленные</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/marketplace/my">Мои пакеты</Link>
          </Button>
          <Button asChild>
            <Link to="/marketplace/publish">
              <Plus className="h-4 w-4 mr-2" />
              Опубликовать
            </Link>
          </Button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge key={c.id} variant="outline">
              {c.name}
            </Badge>
          ))}
        </div>
      )}

      {loadingFeatured ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : featured ? (
        <div className="space-y-8">
          <Section title="Featured" items={featured.featured} />
          <Section title="Популярные" items={featured.popular} />
          <Section title="Новые" items={featured.newest} />
          <Section title="Top Rated" items={featured.topRated} />
          <Section title="Most Installed" items={featured.mostInstalled} />
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Все пакеты</h2>
        {loadingAll ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        ) : packages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Пакетов пока нет. Станьте первым издателем.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
