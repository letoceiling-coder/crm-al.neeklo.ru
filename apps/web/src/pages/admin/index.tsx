import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, RefreshCw, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Badge } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';

export function AdminDashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Обзор платформы</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Общий расход</div><div className="text-2xl font-bold">{overview?.balance?.totalCost?.toFixed(2) ?? 0} ₽</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Маржа</div><div className="text-2xl font-bold">{overview?.balance?.margin?.toFixed(2) ?? 0} ₽</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Токенов</div><div className="text-2xl font-bold">{overview?.tokens?.total ?? 0}</div></CardContent></Card>
      </div>
    </div>
  );
}

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  _count: { apiKeys: number };
  createdAt: string;
};

const emptyCreateForm = () => ({
  email: '',
  password: '',
  name: '',
  role: 'USER',
});

export function AdminUsersPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'USER',
    isActive: true,
    password: '',
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users', { params: { limit: 100 } }).then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: () => api.post('/admin/users', createForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/admin/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingId(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users: AdminUser[] = data?.data ?? [];

  const startEdit = (u: AdminUser) => {
    setShowCreate(false);
    setEditingId(u.id);
    setEditForm({
      name: u.name ?? '',
      role: u.role,
      isActive: u.isActive,
      password: '',
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const body: Record<string, unknown> = {
      name: editForm.name || undefined,
      role: editForm.role,
      isActive: editForm.isActive,
    };
    if (editForm.password.length >= 6) body.password = editForm.password;
    updateUser.mutate({ id: editingId, body });
  };

  const roleSelect = (
    value: string,
    onChange: (role: string) => void,
  ) => (
    <select
      className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="USER">User</option>
      <option value="DEVELOPER">Developer</option>
      <option value="ADMIN">Admin</option>
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-muted-foreground">Создание, редактирование и удаление</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Создать
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Новый пользователь</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              {roleSelect(createForm.role, (role) => setCreateForm({ ...createForm, role }))}
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>
                Создать
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
            {createUser.isError && (
              <p className="sm:col-span-2 text-sm text-destructive">
                Не удалось создать пользователя (возможно, email уже занят)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {editingId && (
        <Card>
          <CardHeader>
            <CardTitle>Редактирование</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              {roleSelect(editForm.role, (role) => setEditForm({ ...editForm, role }))}
            </div>
            <div className="space-y-2">
              <Label>Новый пароль (необязательно)</Label>
              <Input
                type="password"
                placeholder="мин. 6 символов"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Активен
              </label>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={saveEdit} disabled={updateUser.isPending}>
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Имя</th>
                <th className="pb-3 font-medium">Роль</th>
                <th className="pb-3 font-medium">Статус</th>
                <th className="pb-3 font-medium">Ключи</th>
                <th className="pb-3 font-medium">Создан</th>
                <th className="pb-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="py-3">{u.email}</td>
                    <td className="py-3">{u.name ?? '—'}</td>
                    <td className="py-3">
                      <Badge variant="outline">{u.role}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={u.isActive ? 'success' : 'destructive'}>
                        {u.isActive ? 'Активен' : 'Отключён'}
                      </Badge>
                    </td>
                    <td className="py-3">{u._count.apiKeys}</td>
                    <td className="py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={u.id === currentUserId || deleteUser.isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Удалить пользователя ${u.email}? Все его API-ключи будут удалены.`,
                              )
                            ) {
                              return;
                            }
                            deleteUser.mutate(u.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminModelsPage() {
  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: () => api.post('/admin/models/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models Management</h1>
          <p className="text-muted-foreground">Синхронизация и управление моделями OpenRouter</p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
          Синхронизировать
        </Button>
      </div>
      {sync.data && <p className="text-sm text-success">Синхронизировано: {sync.data.data?.synced ?? 0} моделей</p>}
    </div>
  );
}

export function AdminProvidersPage() {
  const [form, setForm] = useState({ name: '', key: '' });
  const queryClient = useQueryClient();

  const { data: keys } = useQuery({
    queryKey: ['openrouter-keys'],
    queryFn: () => api.get('/admin/openrouter/keys').then((r) => r.data),
  });

  const addKey = useMutation({
    mutationFn: () => api.post('/admin/openrouter/keys', { ...form, isDefault: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openrouter-keys'] });
      setForm({ name: '', key: '' });
    },
  });

  const removeKey = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/openrouter/keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['openrouter-keys'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OpenRouter Keys</h1>
        <p className="text-muted-foreground">Управление ключами провайдера</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Добавить ключ</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Название</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>API Key</Label><Input type="password" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></div>
          <div className="sm:col-span-2"><Button onClick={() => addKey.mutate()}>Добавить</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {(keys ?? []).map((k: { id: string; name: string; keyPrefix: string; isActive: boolean; balance?: string }) => (
            <div key={k.id} className="flex items-center justify-between py-3 border-b border-border/50">
              <div>
                <div className="font-medium">{k.name}</div>
                <div className="text-sm text-muted-foreground font-mono">{k.keyPrefix}••••</div>
              </div>
              <div className="flex items-center gap-2">
                {k.balance != null && <span className="text-sm">{Number(k.balance).toFixed(2)} ₽</span>}
                <Badge variant={k.isActive ? 'success' : 'outline'}>{k.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button variant="ghost" size="icon" onClick={() => removeKey.mutate(k.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminAuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/admin/audit').then((r) => r.data),
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Полный аудит действий</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 font-medium">Дата</th>
                <th className="pb-3 font-medium">Действие</th>
                <th className="pb-3 font-medium">Пользователь</th>
                <th className="pb-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="py-8 text-center">Загрузка...</td></tr>
              ) : logs.map((log: { id: string; createdAt: string; action: string; user?: { email: string }; ipAddress?: string }) => (
                <tr key={log.id} className="border-b border-border/50">
                  <td className="py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                  <td className="py-3"><Badge variant="outline">{log.action}</Badge></td>
                  <td className="py-3">{log.user?.email ?? '—'}</td>
                  <td className="py-3 text-muted-foreground">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">Раздел в разработке</p>
      </div>
      <Card>
        <CardContent className="pt-6 flex flex-col items-center py-16">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Функционал доступен через API</p>
        </CardContent>
      </Card>
    </div>
  );
}
