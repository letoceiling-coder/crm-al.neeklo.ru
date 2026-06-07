import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wrench, BookOpen, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ToolsLandingPage() {
  const { data: instances = [] } = useQuery({
    queryKey: ['tool-instances'],
    queryFn: () => api.get('/v1/tools/instances').then((r) => r.data),
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['tool-catalog'],
    queryFn: () => api.get('/v1/tools/catalog').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Инструменты</h1>
        <p className="text-muted-foreground">
          Платформа инструментов для AI ассистентов — подключение, настройка и выполнение действий
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Каталог
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{catalog.length} доступных инструментов</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tools/catalog">Открыть каталог</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Экземпляры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{instances.length} подключено</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/tools/instances">Мои инструменты</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Ассистенты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Привяжите инструменты на вкладке «Инструменты» в карточке ассистента
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/assistants">AI Ассистенты</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
