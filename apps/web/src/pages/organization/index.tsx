import { Link } from 'react-router-dom';
import { Building2, Users, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const sections = [
  { to: '/organization/members', icon: Users, title: 'Участники', desc: 'OWNER, ADMIN, MANAGER, OPERATOR' },
  { to: '/organization/invitations', icon: Mail, title: 'Приглашения', desc: 'Пригласить пользователей в организацию' },
];

export function OrganizationOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Организация</h1>
          <p className="text-muted-foreground">Управление командой и доступом</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
