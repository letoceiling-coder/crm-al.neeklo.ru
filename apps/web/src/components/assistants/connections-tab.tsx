import {
  Send,
  Mail,
  Webhook,
  Building2,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

const INTEGRATIONS: Array<{
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Бот для общения с ассистентом в Telegram-каналах и чатах.',
    icon: Send,
  },
  {
    id: 'max',
    name: 'MAX',
    description: 'Интеграция с мессенджером MAX для корпоративных диалогов.',
    icon: MessageCircle,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Обработка входящих писем и автоматические ответы ассистента.',
    icon: Mail,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'HTTP-вебхуки для внешних систем и автоматизаций.',
    icon: Webhook,
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Связь с CRM: лиды, сделки и контекст клиента в диалогах.',
    icon: Building2,
  },
  {
    id: 'kb',
    name: 'База знаний',
    description: 'Подключение баз знаний для ответов на основе документов.',
    icon: BookOpen,
  },
];

export function AssistantConnectionsTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {INTEGRATIONS.map(({ id, name, description, icon: Icon }) => (
        <Card key={id} className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <Badge variant="outline">Скоро будет доступно</Badge>
            </div>
            <CardTitle className="text-base pt-2">{name}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <p className="text-xs text-muted-foreground">Статус: недоступно</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
