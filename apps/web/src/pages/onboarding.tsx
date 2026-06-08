import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const STEP_LABELS: Record<string, { title: string; description: string; href: string }> = {
  assistant: { title: 'Создайте ассистента', description: 'Первый AI-ассистент для вашей команды', href: '/assistants/create' },
  'knowledge-base': { title: 'Создайте базу знаний', description: 'Загрузите документы для RAG', href: '/knowledge/create' },
  integration: { title: 'Подключите интеграцию', description: 'Telegram, Email или другой канал', href: '/integrations' },
  workflow: { title: 'Создайте workflow', description: 'Автоматизируйте процессы', href: '/workflows/create' },
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => api.get('/v1/onboarding/status').then((r) => r.data),
  });

  const advance = useMutation({
    mutationFn: () => api.post('/v1/onboarding/advance').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  });

  const skip = useMutation({
    mutationFn: () => api.post('/v1/onboarding/skip').then((r) => r.data),
    onSuccess: () => navigate('/'),
  });

  if (!status) return null;
  if (status.completed) {
    navigate('/');
    return null;
  }

  const key = status.currentStepKey as string;
  const step = STEP_LABELS[key];

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Добро пожаловать в AI Gateway</CardTitle>
          <CardDescription>
            Шаг {status.step + 1} из {status.totalSteps}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step && (
            <>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              <Link to={step.href}><Button>Перейти</Button></Link>
            </>
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => advance.mutate()} disabled={advance.isPending}>
              Готово — следующий шаг
            </Button>
            <Button variant="ghost" onClick={() => skip.mutate()} disabled={skip.isPending}>
              Пропустить onboarding
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
