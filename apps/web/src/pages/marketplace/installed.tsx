import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { marketplaceApi, PACKAGE_TYPE_LABELS } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

export function MarketplaceInstalledPage() {
  const { data: installs = [], isLoading } = useQuery({
    queryKey: ['marketplace-installed'],
    queryFn: () => marketplaceApi.listInstalled(),
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/marketplace">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Marketplace
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
          Установленные пакеты
        </h1>
        <p className="text-muted-foreground">Локальные копии в вашей организации (clone-only)</p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : installs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет установленных пакетов.{' '}
            <Link to="/marketplace" className="text-primary hover:underline">
              Перейти в Marketplace
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {installs.map((inst) => (
            <Card key={inst.id}>
              <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    to={`/marketplace/package/${inst.package.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {inst.package.name}
                  </Link>
                  <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                    <Badge variant="outline">{PACKAGE_TYPE_LABELS[inst.package.type]}</Badge>
                    <span>v{inst.version.version}</span>
                    <span>{formatDate(inst.createdAt)}</span>
                    <Badge variant={inst.status === 'ACTIVE' ? 'success' : 'outline'}>
                      {inst.status}
                    </Badge>
                  </div>
                  {inst.clonedEntities && Object.keys(inst.clonedEntities).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      cloned: {JSON.stringify(inst.clonedEntities)}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/marketplace/package/${inst.package.id}`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
