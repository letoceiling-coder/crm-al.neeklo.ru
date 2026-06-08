import { Link } from 'react-router-dom';
import { Activity, Server, Layers, HeartPulse, Shield, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  { to: '/system/metrics', icon: Activity, title: 'Мониторинг', desc: 'CPU, RAM, Redis, PostgreSQL, BullMQ' },
  { to: '/system/queues', icon: Layers, title: 'Очереди', desc: 'Lag, throughput, retry, DLQ' },
  { to: '/system/health', icon: HeartPulse, title: 'Health', desc: 'Состояние платформы' },
  { to: '/system/dependencies', icon: Server, title: 'Зависимости', desc: 'S3, Parser, OpenRouter' },
  { to: '/system/security', icon: Shield, title: 'Безопасность', desc: 'Диагностика tenant, JWT, secrets' },
];

export function SystemOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Система</h1>
        <p className="text-muted-foreground">Enterprise operations — только ADMIN</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <s.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
            </Card>
          </Link>
        ))}
        <Link to="/admin/usage">
          <Card className="h-full hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Cost Anomalies</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Аномалии расходов — см. Usage + /system/metrics</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
