import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  marketplaceApi,
  PACKAGE_TYPE_LABELS,
  type MarketplacePackageType,
  type MarketplaceVisibility,
} from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const PACKAGE_TYPES: MarketplacePackageType[] = [
  'ASSISTANT',
  'WORKFLOW',
  'TOOL',
  'KNOWLEDGE_TEMPLATE',
  'AUTOMATION_PACKAGE',
];

function defaultManifest(type: MarketplacePackageType): Record<string, unknown> {
  switch (type) {
    case 'ASSISTANT':
      return {
        type,
        assistant: { name: '', systemPrompt: 'You are a helpful assistant.' },
      };
    case 'WORKFLOW':
      return {
        type,
        workflow: {
          name: '',
          triggerType: 'MANUAL',
          triggerConfig: {},
          steps: [
            { stepKey: 'start', stepType: 'START', position: 0, configuration: {} },
            { stepKey: 'end', stepType: 'END', position: 1, configuration: {} },
          ],
        },
      };
    case 'TOOL':
      return { type, tools: [{ definitionSlug: 'http-request', name: 'HTTP Request' }] };
    case 'KNOWLEDGE_TEMPLATE':
      return { type, knowledgeTemplate: { name: '', description: '' } };
    default:
      return {
        type,
        assistant: { name: '', systemPrompt: 'Automation assistant' },
        workflow: {
          name: '',
          triggerType: 'MANUAL',
          triggerConfig: {},
          steps: [
            { stepKey: 'start', stepType: 'START', position: 0, configuration: {} },
            { stepKey: 'end', stepType: 'END', position: 1, configuration: {} },
          ],
        },
      };
  }
}

export function MarketplacePublishPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MarketplacePackageType>('ASSISTANT');
  const [visibility, setVisibility] = useState<MarketplaceVisibility>('PUBLIC');
  const [categoryId, setCategoryId] = useState('');
  const [manifestJson, setManifestJson] = useState(
    JSON.stringify(defaultManifest('ASSISTANT'), null, 2),
  );

  const { data: categories = [] } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: () => marketplaceApi.listCategories(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const manifest = JSON.parse(manifestJson) as Record<string, unknown>;
      const pkg = await marketplaceApi.createPackage({
        name,
        description,
        type,
        visibility,
        categoryId: categoryId || undefined,
        manifest,
        version: '1.0.0',
      });
      await marketplaceApi.publishVersion(pkg.id, {
        version: '1.0.0',
        changelog: 'Initial release',
        manifest,
      });
      return pkg;
    },
    onSuccess: (pkg) => navigate(`/marketplace/package/${pkg.id}`),
  });

  const onTypeChange = (next: MarketplacePackageType) => {
    setType(next);
    setManifestJson(JSON.stringify(defaultManifest(next), null, 2));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/marketplace">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Marketplace
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Опубликовать пакет</h1>
        <p className="text-muted-foreground">Создание и публикация v1.0.0</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Основное</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Название</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="desc" className="text-sm font-medium">Описание</label>
            <textarea
              id="desc"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">Тип</label>
            <select
              id="type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => onTypeChange(e.target.value as MarketplacePackageType)}
            >
              {PACKAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PACKAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="vis" className="text-sm font-medium">Видимость</label>
            <select
              id="vis"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as MarketplaceVisibility)}
            >
              <option value="PUBLIC">Публичный</option>
              <option value="PRIVATE">Приватный</option>
              <option value="ORG_ONLY">Только организация</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="cat" className="text-sm font-medium">Категория</label>
            <select
              id="cat"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="manifest" className="text-sm font-medium">Manifest (JSON)</label>
            <textarea
              id="manifest"
              className="w-full min-h-[200px] font-mono text-xs rounded-md border border-input bg-background px-3 py-2"
              value={manifestJson}
              onChange={(e) => setManifestJson(e.target.value)}
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Публикация…' : 'Создать и опубликовать'}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-destructive">Ошибка публикации. Проверьте manifest.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
