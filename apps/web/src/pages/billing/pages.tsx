import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { billingApi } from '@/lib/billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export function BillingSubscriptionPage() {
  const qc = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ['billing-plans'], queryFn: billingApi.getPlans });
  const { data: sub } = useQuery({ queryKey: ['billing-sub'], queryFn: billingApi.getSubscription });

  const change = useMutation({
    mutationFn: (tier: string) => billingApi.changePlan(tier),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-sub'] });
      qc.invalidateQueries({ queryKey: ['billing-limits'] });
    },
  });

  return (
    <div className="space-y-6">
      <Link to="/billing" className="text-sm text-muted-foreground hover:text-foreground">← Биллинг</Link>
      <h1 className="text-2xl font-bold">Подписка</h1>
      {sub && (
        <Card>
          <CardHeader><CardTitle>Текущий тариф: {sub.plan?.name}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Статус: {sub.status}</p>
            <p>Обновление: {sub.renewalDate ? new Date(sub.renewalDate).toLocaleDateString('ru-RU') : '—'}</p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(plans ?? []).map((p: { id: string; tier: string; name: string; priceMonthlyRub: string; description?: string }) => (
          <Card key={p.id} className={sub?.plan?.tier === p.tier ? 'border-primary' : ''}>
            <CardHeader><CardTitle>{p.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-2xl font-bold">{formatCurrency(Number(p.priceMonthlyRub))}<span className="text-sm font-normal">/мес</span></p>
              <p className="text-muted-foreground">{p.description}</p>
              <Button
                size="sm"
                disabled={sub?.plan?.tier === p.tier || change.isPending}
                onClick={() => change.mutate(p.tier)}
              >
                {sub?.plan?.tier === p.tier ? 'Активен' : 'Выбрать'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BillingUsagePage() {
  const { data: usage } = useQuery({ queryKey: ['billing-usage'], queryFn: billingApi.getUsage });
  const { data: limits } = useQuery({ queryKey: ['billing-limits'], queryFn: billingApi.getLimits });

  return (
    <div className="space-y-6">
      <Link to="/billing" className="text-sm text-muted-foreground hover:text-foreground">← Биллинг</Link>
      <h1 className="text-2xl font-bold">Использование</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-base">Запросы (мес.)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{usage?.requests ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Токены (мес.)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{usage?.tokens?.toLocaleString('ru-RU') ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Хранилище MB</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{usage?.storageMb ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Расход ₽</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(usage?.costRub ?? 0)}</CardContent></Card>
      </div>
      {limits?.usage && (
        <Card>
          <CardHeader><CardTitle>Лимиты тарифа</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(limits.usage as Record<string, { used: number; limit: number }>).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border py-1">
                <span>{k}</span>
                <span>{v.used} / {v.limit}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="flex gap-2 flex-wrap">
        {(['usage', 'audit', 'crm', 'workflow', 'marketplace'] as const).map((d) => (
          <a key={d} href={`/api/v1/exports/${d}?format=csv`} className="text-sm underline text-primary">Экспорт {d} CSV</a>
        ))}
      </div>
    </div>
  );
}

export function BillingInvoicesPage() {
  const { data: invoices } = useQuery({ queryKey: ['billing-invoices'], queryFn: billingApi.getInvoices });

  return (
    <div className="space-y-6">
      <Link to="/billing" className="text-sm text-muted-foreground hover:text-foreground">← Биллинг</Link>
      <h1 className="text-2xl font-bold">Счета</h1>
      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th>№</th><th>Сумма</th><th>Статус</th><th>Период</th></tr></thead>
            <tbody>
              {(invoices ?? []).map((inv: { id: string; invoiceNumber: string; amountRub: string; status: string; periodStart: string; periodEnd: string }) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="py-2">{inv.invoiceNumber}</td>
                  <td>{formatCurrency(Number(inv.amountRub))}</td>
                  <td>{inv.status}</td>
                  <td>{new Date(inv.periodStart).toLocaleDateString('ru-RU')} — {new Date(inv.periodEnd).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!invoices?.length && <p className="text-muted-foreground py-4">Счетов пока нет</p>}
        </CardContent>
      </Card>
    </div>
  );
}
