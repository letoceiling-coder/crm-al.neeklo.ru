import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderTree, Tag, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssistantEmptyState } from '@/components/assistants/empty-state';
import type { KnowledgeCategory, KnowledgeTopic, KnowledgeTag } from '@/lib/knowledge';

type TabKind = 'categories' | 'topics' | 'tags';

interface Props {
  kind: TabKind;
  knowledgeBaseId: string;
  categories: KnowledgeCategory[];
  topics: KnowledgeTopic[];
  tags: KnowledgeTag[];
}

export function KnowledgeTaxonomyTab({ kind, knowledgeBaseId, categories, topics, tags }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showForm, setShowForm] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['knowledge-base', knowledgeBaseId] });

  const createMutation = useMutation({
    mutationFn: () => {
      if (kind === 'categories') {
        return api.post('/v1/knowledge-categories', { knowledgeBaseId, name: name.trim() });
      }
      if (kind === 'topics') {
        return api.post('/v1/knowledge-topics', {
          knowledgeBaseId,
          categoryId,
          name: name.trim(),
        });
      }
      return api.post('/v1/knowledge-tags', { knowledgeBaseId, name: name.trim() });
    },
    onSuccess: () => {
      invalidate();
      setName('');
      setShowForm(false);
    },
  });

  const items =
    kind === 'categories' ? categories : kind === 'topics' ? topics : tags;

  const titles = {
    categories: 'Категории',
    topics: 'Темы',
    tags: 'Теги',
  };

  const icons = {
    categories: FolderTree,
    topics: Hash,
    tags: Tag,
  };

  const Icon = icons[kind];

  return (
    <div className="space-y-6">
      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новая запись</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kind === 'topics' && (
              <div className="space-y-2">
                <Label>Категория</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Выберите категорию</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={
                  !name.trim() ||
                  (kind === 'topics' && !categoryId) ||
                  createMutation.isPending
                }
                onClick={() => createMutation.mutate()}
              >
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6">
            <AssistantEmptyState
              icon={Icon}
              title={`${titles[kind]} не созданы`}
              description="Добавьте элементы таксономии для организации документов"
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{item.name}</span>
                <code className="ml-2 text-xs text-muted-foreground">{item.slug}</code>
                {kind === 'topics' && 'category' in item && (item as KnowledgeTopic).category && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({(item as KnowledgeTopic).category!.name})
                  </span>
                )}
              </div>
              {'_count' in item && (item as KnowledgeCategory)._count?.documents != null && (
                <span className="text-muted-foreground">
                  {(item as KnowledgeCategory)._count!.documents} док.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
