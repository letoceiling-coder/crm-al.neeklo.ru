import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/stat-card';
import { formatCurrency } from '@/lib/utils';
import {
  ProfileForm,
  emptyProfileForm,
  profileToPayload,
  apiProfileToForm,
  useModelsForProfilePayload,
} from '@/components/key-model-profiles/profile-form';

interface KeyModelProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  pricePerMillionRub: number;
  isActive: boolean;
  modelChain: Array<{
    modelId: string;
    priority: number;
    model: { id: string; name: string; openrouterId: string };
  }>;
}

export function KeyModelProfilesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyProfileForm());
  const [editForm, setEditForm] = useState(emptyProfileForm());
  const queryClient = useQueryClient();
  const models = useModelsForProfilePayload();

  const { data: profiles, isLoading } = useQuery<KeyModelProfile[]>({
    queryKey: ['key-model-profiles'],
    queryFn: () => api.get('/key-model-profiles').then((r) => r.data),
  });

  const closePanels = () => {
    setShowCreate(false);
    setEditingId(null);
    setCreateForm(emptyProfileForm());
    setEditForm(emptyProfileForm());
  };

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof profileToPayload>) =>
      api.post('/key-model-profiles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-model-profiles'] });
      closePanels();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnType<typeof profileToPayload> }) =>
      api.put(`/key-model-profiles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-model-profiles'] });
      closePanels();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/key-model-profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-model-profiles'] });
    },
  });

  const startEdit = async (profile: KeyModelProfile) => {
    setShowCreate(false);
    setEditingId(profile.id);
    const { data } = await api.get(`/key-model-profiles/${profile.id}`);
    setEditForm(apiProfileToForm(data));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Модели для ключей</h1>
          <p className="text-muted-foreground">
            Готовые конфигурации: название, цепочка OpenRouter и цена за 1M токенов
          </p>
        </div>
        <Button
          onClick={() => {
            closePanels();
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Создать модель
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Новая модель для ключей</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              values={createForm}
              onChange={setCreateForm}
              onSubmit={() => createMutation.mutate(profileToPayload(createForm, models))}
              onCancel={closePanels}
              submitLabel="Создать"
              isPending={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {editingId && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Редактирование модели</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              values={editForm}
              onChange={setEditForm}
              onSubmit={() =>
                updateMutation.mutate({
                  id: editingId,
                  data: profileToPayload(editForm, models),
                })
              }
              onCancel={closePanels}
              submitLabel="Сохранить"
              isPending={updateMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !profiles?.length ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Нет моделей"
            description="Создайте профиль с цепочкой OpenRouter — его можно будет выбрать при выпуске API-ключа"
            action={
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Создать модель
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{profile.name}</h3>
                      <Badge variant="outline">{profile.slug}</Badge>
                      {!profile.isActive && <Badge variant="destructive">OFF</Badge>}
                    </div>
                    {profile.description && (
                      <p className="text-sm text-muted-foreground">{profile.description}</p>
                    )}
                    <p className="text-sm mt-2">
                      {formatCurrency(profile.pricePerMillionRub)} / 1M токенов
                    </p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {profile.modelChain
                        ?.sort((a, b) => a.priority - b.priority)
                        .map((c, i) => (
                          <Badge key={c.modelId} variant="outline" className="text-xs">
                            {i + 1}. {c.model?.name ?? c.modelId}
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      API: <code>model: "{profile.slug}"</code>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(profile)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Удалить модель?')) deleteMutation.mutate(profile.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
