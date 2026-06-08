import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const docs: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Service',
    body: 'Используя AI Gateway Platform, вы соглашаетесь с условиями предоставления сервиса, лимитами тарифа и политикой fair use. Платформа предоставляется «как есть» до заключения Enterprise SLA.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'Мы обрабатываем персональные данные пользователей и контент организаций в соответствии с 152-ФЗ. Данные изолированы по organizationId. Эмбеддинги и документы хранятся в tenant-prefixed S3.',
  },
  cookies: {
    title: 'Cookie Policy',
    body: 'Приложение использует JWT-сессию и локальное хранилище для темы интерфейса. Сторонние аналитические cookie не используются.',
  },
  dpa: {
    title: 'Data Processing Agreement',
    body: 'Шаблон DPA для Enterprise-клиентов: оператор — заказчик, процессор — AI Gateway Platform. Субобработчики: OpenRouter, S3-хранилище, Parser service.',
  },
  'marketplace-publisher': {
    title: 'Marketplace Publisher Agreement',
    body: 'Публикуя пакет в Marketplace, вы подтверждаете права на контент, согласие с модерацией и условиями монетизации (FREE / PAID / SUBSCRIPTION) без автоматических выплат на Stage 11.',
  },
};

export function LegalDocumentPage({ slug }: { slug: string }) {
  const doc = docs[slug] ?? { title: 'Документ', body: 'Не найден' };
  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/legal/terms" className="text-sm text-muted-foreground">Legal</Link>
      <h1 className="text-2xl font-bold">{doc.title}</h1>
      <Card><CardContent className="pt-6 prose prose-sm dark:prose-invert"><p>{doc.body}</p></CardContent></Card>
    </div>
  );
}

export function LegalIndexPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Legal</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(docs).map(([slug, d]) => (
          <Link key={slug} to={`/legal/${slug === 'marketplace-publisher' ? 'marketplace-publisher' : slug}`}>
            <Card className="hover:border-primary/50"><CardHeader><CardTitle className="text-base">{d.title}</CardTitle></CardHeader></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BackupsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Резервные копии</h1>
      <Card>
        <CardHeader><CardTitle>Статус</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>DB backups: /var/backups (production)</p>
          <p>S3: tenant-isolated bucket crm-al-knowledge</p>
          <p>Recovery: восстановление из pre-deploy snapshot Stage 10.1</p>
          <p>API: GET /api/v1/backups/status</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SupportDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Support Dashboard</h1>
      <p className="text-muted-foreground">Admin only — GET /api/v1/support/dashboard</p>
      <Card><CardContent className="pt-6 text-sm">Organizations, errors 24h, queue failures, marketplace issues</CardContent></Card>
    </div>
  );
}
