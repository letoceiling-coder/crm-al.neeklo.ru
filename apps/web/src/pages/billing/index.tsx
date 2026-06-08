import { Link } from 'react-router-dom';
import { CreditCard, Receipt, BarChart3, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  { to: '/billing/subscription', icon: CreditCard, title: 'Подписка', desc: 'Текущий тариф и смена плана' },
  { to: '/billing/usage', icon: BarChart3, title: 'Использование', desc: 'Запросы, токены, хранилище' },
  { to: '/billing/invoices', icon: Receipt, title: 'Счета', desc: 'История счетов организации' },
  { to: '/billing/usage', icon: Gauge, title: 'Лимиты', desc: 'RPM и квоты тарифа' },
];

export function BillingOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Биллинг</h1>
        <p className="text-muted-foreground">Тарификация организации — без платёжного шлюза на Stage 11</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.to + s.title} to={s.to}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <s.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
