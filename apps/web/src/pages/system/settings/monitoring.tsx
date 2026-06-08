import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { systemApi } from '@/lib/system';
import { systemSettingsApi } from '@/lib/system-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsSecurityPage() {
  const { data } = useQuery({ queryKey: ['system-security'], queryFn: () => systemApi.getSecurity() });
  return (
    <Card>
      <CardHeader><CardTitle>Безопасность</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Диагностика JWT, secrets и tenant isolation.</p>
        <Button variant="outline" asChild><Link to="/system/security">Открыть полную диагностику безопасности</Link></Button>
        <pre className="text-xs overflow-auto max-h-96 rounded-lg bg-muted p-4">{JSON.stringify(data, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}

export function SettingsStoragePage() {
  const { data: deps } = useQuery({ queryKey: ['system-deps'], queryFn: () => systemApi.getDependencies() });
  const s3 = deps?.dependencies?.find((d: { name: string }) => d.name === 'S3');
  return (
    <Card>
      <CardHeader><CardTitle>Хранилище</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">S3 object storage для баз знаний и документов.</p>
        <div className={`inline-flex rounded-full px-3 py-1 text-sm ${s3?.ok ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
          S3: {s3?.ok ? 'Healthy' : 'Error'}
        </div>
        <Button variant="outline" asChild><Link to="/system/dependencies">Зависимости и storage</Link></Button>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Healthy' ? 'bg-green-500/10 text-green-700' :
    status === 'Warning' ? 'bg-yellow-500/10 text-yellow-800' :
    'bg-destructive/10 text-destructive';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export function SettingsMonitoringPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings-health'], queryFn: systemSettingsApi.getIntegrationHealth });
  const { data: parser } = useQuery({ queryKey: ['settings-parser'], queryFn: systemSettingsApi.getParser });
  const [parserKey, setParserKey] = useState('');
  const [parserMsg, setParserMsg] = useState('');

  const saveParser = useMutation({
    mutationFn: () => systemSettingsApi.updateParser({ apiKey: parserKey || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-parser'] });
      setParserKey('');
      setParserMsg('Parser API key сохранён');
    },
  });

  const entries = data ? Object.entries(data as Record<string, string>) : [];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>HTML Parser (parser-html-site)</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <p className="text-sm text-muted-foreground">
            API key для <code>pars-site.neeklo.ru/v1/parse</code> — только server-side, не отображается после сохранения.
          </p>
          <p className="text-sm">
            Base URL: <code>{parser?.baseUrl ?? 'https://pars-site.neeklo.ru'}</code>
            {' · '}
            {parser?.configured ? (
              <span className="text-green-600">API key установлен</span>
            ) : (
              <span className="text-destructive">API key не настроен</span>
            )}
          </p>
          <Input
            type="password"
            placeholder="Parser API key"
            value={parserKey}
            onChange={(e) => setParserKey(e.target.value)}
          />
          <Button onClick={() => saveParser.mutate()} disabled={!parserKey || saveParser.isPending}>
            Save API Key
          </Button>
          {parserMsg && <p className="text-sm text-muted-foreground">{parserMsg}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Мониторинг интеграций</CardTitle></CardHeader>
        <CardContent>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Сервис</th><th>Статус</th></tr></thead>
          <tbody>
            {entries.map(([name, status]) => (
              <tr key={name} className="border-b border-border/50">
                <td className="py-2 capitalize">{name}</td>
                <td><StatusBadge status={status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/system/health">Health</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/system/queues">Queues</Link></Button>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
